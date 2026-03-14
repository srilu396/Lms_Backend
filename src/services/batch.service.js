const fs = require('fs');
const csvParser = require('csv-parser');
const { Batch, Enrollment, Student, Institution, User, sequelize, Sequelize } = require('../models');
const { Op } = Sequelize;

class BatchService {
    async createBatch(data) {
        const transaction = await sequelize.transaction();
        try {
            const batch = await Batch.create({
                name: data.name,
                institution_id: data.institution_id || null,
                course_id: data.course_id || null,
                instructor_id: data.instructor_id || null,
                start_date: data.start_date || null,
                end_date: data.end_date || null,
                status: data.status || 'active'
            }, { transaction });

            if (data.enroll_students && Array.isArray(data.enroll_students) && data.enroll_students.length > 0) {
                const enrollments = data.enroll_students.map(studentId => ({
                    student_id: studentId,
                    batch_id: batch.id,
                    status: 'active'
                }));
                await Enrollment.bulkCreate(enrollments, { transaction, ignoreDuplicates: true });
            }

            await transaction.commit();

            if (data.file_path) {
                try {
                    await this.bulkUploadStudentsToBatch(batch.id, data.file_path);
                } catch (bulkError) {
                    console.error('Error in bulk upload during nested batch creation:', bulkError);
                    // Silently fail but continue returning batch since it created successfully
                }
            }

            return await this.getBatchById(batch.id);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async getBatches(query) {
        const { search, status, page = 1, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const where = {};
        if (status) {
            let parsedStatus = status.toLowerCase();
            if (parsedStatus === 'complete') {
                parsedStatus = 'completed';
            }
            where.status = parsedStatus;
        }

        if (search) {
            where.name = { [Op.iLike]: `%${search.trim()}%` };
        }

        const includeOptions = [
            {
                model: User,
                as: 'instructor',
                attributes: ['id', 'full_name'],
                required: false
            },
            {
                model: Institution,
                attributes: ['id', 'name'],
                required: false
            }
        ];

        const { count, rows } = await Batch.findAndCountAll({
            where,
            include: includeOptions,
            limit: parsedLimit,
            offset: offset,
            order: [['created_at', 'DESC']]
        });

        const formattedRows = rows.map(row => {
            const batch = row.toJSON();
            return {
                id: batch.id,
                batch_id: `#BATCH-${batch.id}`,
                batch_name: batch.name,
                institution_name: batch.Institution ? batch.Institution.name : null,
                instructor: batch.instructor ? batch.instructor.full_name : null,
                course: null,
                completion_progress: null, // As requested
                status: batch.status
            };
        });

        return {
            data: formattedRows,
            pagination: {
                total: count,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(count / parsedLimit)
            }
        };
    }

    async getBatchById(id) {
        const includeOptions = [
            {
                model: User,
                as: 'instructor',
                attributes: ['id', 'full_name'],
                required: false
            },
            {
                model: Institution,
                attributes: ['id', 'name'],
                required: false
            }
        ];

        const batch = await Batch.findByPk(id, { include: includeOptions });
        if (!batch) {
            const error = new Error('Batch not found');
            error.statusCode = 404;
            throw error;
        }

        const batchJson = batch.toJSON();
        return {
            ...batchJson,
            batch_id: `#BATCH-${batch.id}`,
            instructor_name: batchJson.instructor ? batchJson.instructor.full_name : null,
            course: null
        };
    }

    async updateBatch(id, updateData) {
        const transaction = await sequelize.transaction();
        try {
            const batch = await Batch.findByPk(id);
            if (!batch) {
                const error = new Error('Batch not found');
                error.statusCode = 404;
                throw error;
            }

            await batch.update(updateData, { transaction });

            if (updateData.enroll_students && Array.isArray(updateData.enroll_students)) {
                if (updateData.enroll_students.length > 0) {
                    const enrollments = updateData.enroll_students.map(studentId => ({
                        student_id: studentId,
                        batch_id: batch.id,
                        status: 'active'
                    }));
                    await Enrollment.bulkCreate(enrollments, { transaction, ignoreDuplicates: true });
                }
            }

            await transaction.commit();
            return await this.getBatchById(id);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async deleteBatch(id) {
        const batch = await Batch.findByPk(id);
        if (!batch) {
            const error = new Error('Batch not found');
            error.statusCode = 404;
            throw error;
        }

        await batch.destroy();
        return true;
    }

    async getTotalCount() {
        const count = await Batch.count();
        return { total_batches: count };
    }

    async getActiveCount() {
        const count = await Batch.count({ where: { status: 'active' } });
        return { active_batches: count };
    }

    async getAverageStudents() {
        const batchCount = await Batch.count();
        if (batchCount === 0) return { average_students_per_batch: 0 };

        const enrollmentCount = await Enrollment.count();
        const average = (enrollmentCount / batchCount).toFixed(1);
        
        return { average_students_per_batch: parseFloat(average) };
    }

    async getBatchStudents(batchId, query) {
        const { search, status, page = 1, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        // Extract numeric ID safely in case the client sends '#BATCH-XX' URL-encoded
        const numericBatchId = typeof batchId === 'string' ? parseInt(batchId.replace(/[^0-9]/g, ''), 10) : batchId;
        const whereEnrollment = { batch_id: numericBatchId || batchId };
        
        if (status) {
            let parsedStatus = status.toLowerCase();
            if (parsedStatus === 'complete') parsedStatus = 'completed';
            whereEnrollment.status = parsedStatus;
        }

        const whereStudent = {};
        if (search) {
            const safeSearch = search.trim();
            whereStudent[Op.or] = [
                { first_name: { [Op.iLike]: `%${safeSearch}%` } },
                { last_name: { [Op.iLike]: `%${safeSearch}%` } },
                { email: { [Op.iLike]: `%${safeSearch}%` } }
            ];
        }

        const { count, rows } = await Enrollment.findAndCountAll({
            where: whereEnrollment,
            include: [
                {
                    model: Student,
                    as: 'student',
                    where: Object.keys(whereStudent).length ? whereStudent : undefined,
                    attributes: ['id', 'first_name', 'last_name', 'email']
                }
            ],
            limit: parsedLimit,
            offset: offset,
            order: [['created_at', 'DESC']]
        });

        const formattedStudents = rows.map(row => {
            const enrollment = row.toJSON();
            const student = enrollment.student || {};
            return {
                id: student.id || enrollment.student_id,
                student_id: `#STUDENT-${student.id || enrollment.student_id}`,
                student_name: `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Unknown Student',
                student_email: student.email || 'N/A',
                enrolled_date: enrollment.enrollment_date,
                completion: 0,
                status: enrollment.status ? enrollment.status.toUpperCase() : null
            };
        });

        return {
            data: formattedStudents,
            pagination: {
                total: count,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(count / parsedLimit)
            }
        };
    }

    async bulkUploadStudentsToBatch(batchId, filePath) {
        return new Promise((resolve, reject) => {
            const students = [];
            const studentIdsToEnroll = new Set();

            fs.createReadStream(filePath)
                .pipe(csvParser())
                .on('data', (row) => {
                    if (row.student_id) {
                        // Handle format: #STUDENT-1 or simply 1
                        const numericId = parseInt(row.student_id.toString().replace(/[^0-9]/g, ''), 10);
                        if (!isNaN(numericId)) {
                            studentIdsToEnroll.add(numericId);
                        }
                    } else if (row.email && row.first_name && row.last_name && row.password) {
                        students.push({
                            first_name: row.first_name,
                            last_name: row.last_name,
                            email: row.email,
                            mobile_number: row.mobile_number || null,
                            password: row.password,
                            notes: row.notes || null
                        });
                    }
                })
                .on('end', async () => {
                    try {
                        if (students.length === 0 && studentIdsToEnroll.size === 0) {
                            return reject(new Error('No valid student data found in CSV'));
                        }

                        let newStudents = [];
                        const allStudentIds = Array.from(studentIdsToEnroll);

                        if (students.length > 0) {
                            // Handle unique creation exactly like Student Service
                            const emails = students.map(s => s.email);
                            const existingStudents = await Student.findAll({
                                where: { email: { [Op.in]: emails } },
                                attributes: ['id', 'email']
                            });
                            
                            const existingStudentMap = new Map();
                            existingStudents.forEach(s => existingStudentMap.set(s.email, s.id));

                            const uniqueStudentsToInsert = [];
                            const seenEmailsInCsv = new Set();
                            
                            // Deduplicate within the CSV file
                            for (const student of students) {
                                if (!existingStudentMap.has(student.email) && !seenEmailsInCsv.has(student.email)) {
                                    uniqueStudentsToInsert.push(student);
                                    seenEmailsInCsv.add(student.email);
                                }
                            }

                            if (uniqueStudentsToInsert.length > 0) {
                                newStudents = await Student.bulkCreate(uniqueStudentsToInsert, { individualHooks: true });
                                newStudents.forEach(s => existingStudentMap.set(s.email, s.id));
                            }

                            // Collect valid student IDs to enroll from the detailed student rows
                            [...seenEmailsInCsv].forEach(email => {
                                const id = existingStudentMap.get(email);
                                if (id && !allStudentIds.includes(id)) {
                                    allStudentIds.push(id);
                                }
                            });
                            
                            for(const std of students) {
                                if (existingStudentMap.has(std.email)) {
                                    const id = existingStudentMap.get(std.email);
                                    if (id && !allStudentIds.includes(id)) {
                                        allStudentIds.push(id);
                                    }
                                }
                            }
                        }

                        // Verify that the explicitly provided student IDs actually exist before enrolling
                        let finalValidStudentIds = allStudentIds;
                        if (studentIdsToEnroll.size > 0) {
                            const validStudentsDb = await Student.findAll({
                                where: { id: { [Op.in]: allStudentIds } },
                                attributes: ['id']
                            });
                            finalValidStudentIds = validStudentsDb.map(s => s.id);
                        }

                        // Create enrollments for the batch
                        const enrollments = finalValidStudentIds.map(studentId => ({
                            student_id: studentId,
                            batch_id: batchId,
                            status: 'active'
                        }));
                        
                        let createdEnrollments = [];
                        if (enrollments.length > 0) {
                            createdEnrollments = await Enrollment.bulkCreate(enrollments, { ignoreDuplicates: true });
                        }

                        try {
                            fs.unlinkSync(filePath);
                        } catch (err) {
                            console.error('Error deleting temp file:', err);
                        }

                        resolve({
                            processed_rows: students.length + studentIdsToEnroll.size,
                            students_inserted: newStudents.length,
                            students_enrolled: createdEnrollments.length
                        });
                    } catch (error) {
                        try { fs.unlinkSync(filePath); } catch (e) {}
                        reject(error);
                    }
                })
                .on('error', (error) => {
                    try { fs.unlinkSync(filePath); } catch (e) {}
                    reject(error);
                });
        });
    }
}

module.exports = new BatchService();
