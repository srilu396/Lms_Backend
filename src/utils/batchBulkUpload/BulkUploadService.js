const fs = require('fs');
const { Batch, BatchTutor, Enrollment, sequelize } = require('../../models');
const ErrorBuilder = require('./ErrorBuilder');
const CsvParser = require('./CsvParser');
const EntityResolver = require('./EntityResolver');
const BatchValidator = require('./BatchValidator');

class BulkUploadService {
    static async processUpload(filePath, defaultInstitutionId) {
        const errorBuilder = new ErrorBuilder();
        
        try {
            // 1. Parse CSV
            const rawRows = await CsvParser.parse(filePath, errorBuilder);
            
            if (errorBuilder.hasErrors()) {
                BulkUploadService._cleanupFile(filePath);
                return BulkUploadService._buildErrorResponse(errorBuilder);
            }

            // 2. Resolve Entities
            const resolver = new EntityResolver(defaultInstitutionId);
            await resolver.resolveAll(rawRows, errorBuilder);

            // Fetch existing batches to validate uniqueness
            const existingBatches = await Batch.findAll({ attributes: ['name'] });
            const existingBatchNames = new Set(existingBatches.map(b => b.name.toLowerCase()));
            
            const batchesToCreateMap = new Map();

            // 3. Map & Validate Rows
            for (const row of rawRows) {
                const batchNameKey = row.name ? row.name.toLowerCase() : '';

                if (!batchesToCreateMap.has(batchNameKey)) {
                    const { startDate, endDate } = BatchValidator.validateBatchLogic(row, existingBatchNames, errorBuilder);
                    
                    const institution = resolver.resolveInstitution(row.institution, row._rowNum, errorBuilder);
                    const course = resolver.resolveCourse(row.course, row._rowNum, errorBuilder);
                    const instructor = resolver.resolveInstructor(row.instructor, row._rowNum, errorBuilder);

                    batchesToCreateMap.set(batchNameKey, {
                        batchObj: {
                            name: row.name,
                            course_id: course ? course.id : null,
                            institution_id: institution ? institution.id : null,
                            start_date: startDate,
                            end_date: endDate,
                            status: row.status || 'active'
                        },
                        instructorId: instructor ? instructor.id : null,
                        instId: institution ? institution.id : null,
                        studentIds: new Set()
                    });
                }

                const batchData = batchesToCreateMap.get(batchNameKey);
                if (batchData && batchData.instId) {
                    const students = resolver.resolveStudents(row.enroll_students, batchData.instId, row._rowNum, errorBuilder);
                    students.forEach(s => batchData.studentIds.add(s.id));
                }
            }

            if (errorBuilder.hasErrors()) {
                BulkUploadService._cleanupFile(filePath);
                return BulkUploadService._buildErrorResponse(errorBuilder);
            }

            // 4. Transactional Insert
            const batchesToCreate = Array.from(batchesToCreateMap.values());
            let createdCount = 0;

            const transaction = await sequelize.transaction();
            try {
                for (const b of batchesToCreate) {
                    const newBatch = await Batch.create(b.batchObj, { transaction });
                    createdCount++;

                    if (b.instructorId) {
                        await BatchTutor.create({
                            batch_id: newBatch.id,
                            tutor_id: b.instructorId,
                            is_primary: true
                        }, { transaction });
                    }

                    if (b.studentIds.size > 0) {
                        const enrollments = Array.from(b.studentIds).map(sId => ({
                            student_id: sId,
                            batch_id: newBatch.id,
                            status: 'active'
                        }));
                        await Enrollment.bulkCreate(enrollments, { transaction, ignoreDuplicates: true });
                    }
                }
                await transaction.commit();
            } catch (txError) {
                await transaction.rollback();
                throw txError;
            }

            BulkUploadService._cleanupFile(filePath);

            return {
                success: true,
                message: 'Batches created successfully',
                data: {
                    processed_rows: rawRows.length,
                    created_count: createdCount
                }
            };
        } catch (error) {
            BulkUploadService._cleanupFile(filePath);
            throw error;
        }
    }

    static _cleanupFile(filePath) {
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (e) {}
    }

    static _buildErrorResponse(errorBuilder) {
        const errorResult = errorBuilder.build();
        const errorMsg = new Error('Validation failed');
        errorMsg.statusCode = 400;
        errorMsg.validationErrors = errorResult;
        throw errorMsg;
    }
}

module.exports = BulkUploadService;
