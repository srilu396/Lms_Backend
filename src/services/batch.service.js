const { Batch, Course, Institution, Enrollment, BatchTutor, BatchAssignment, Assignment, BatchPerformance, User, Student, sequelize } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const csvParser = require('csv-parser');

class BatchService {
    /**
     * Create a new batch
     */
    async createBatch(data) {
        const { enroll_students, ...batchData } = data;
        const transaction = await sequelize.transaction();
        let batch;

        try {
            batch = await Batch.create(batchData, { transaction });

            if (enroll_students && Array.isArray(enroll_students) && enroll_students.length > 0) {
                const enrollments = enroll_students.map(studentId => ({
                    student_id: studentId,
                    batch_id: batch.id,
                    status: 'active'
                }));
                await Enrollment.bulkCreate(enrollments, { transaction, ignoreDuplicates: true });
            }

            await transaction.commit();
        } catch (error) {
            if (transaction) await transaction.rollback();
            throw error;
        }

        try {
            return await this.getBatchById(batch.id);
        } catch (fetchError) {
            console.error('Batch created but could not fetch full details:', fetchError);
            return batch;
        }
    }

    /**
     * Get batches with pagination and search
     */
    async getBatches(query) {
        const { 
            page = 1, 
            limit = 10, 
            search = '', 
            status = 'all',
            institution_id = null,
            course_id = null,
            tutor_id = null
        } = query;

        const offset = (page - 1) * limit;
        const whereClause = {};

        if (status !== 'all') {
            whereClause.status = status;
        }

        if (institution_id) {
            whereClause.institution_id = institution_id;
        }

        if (course_id) {
            whereClause.course_id = course_id;
        }

        if (tutor_id) {
            whereClause.tutor_id = tutor_id;
        }

        if (search) {
            whereClause.name = { [Op.iLike]: `%${search}%` };
        }

        const { rows: batches, count } = await Batch.findAndCountAll({
            where: whereClause,
            include: [
                { model: Course, attributes: ['id', 'name'] },
                { model: Institution, attributes: ['id', 'name'] },
                { model: User, as: 'tutor', attributes: ['id', 'full_name'] }
            ],
            limit,
            offset,
            order: [['created_at', 'DESC']]
        });

        const formattedBatches = batches.map(batch => {
            const batchJson = batch.toJSON();
            return {
                id: batchJson.id,
                batch_id: `#BATCH-${batchJson.id}`,
                batch_name: batchJson.name,
                institution_name: batchJson.Institution?.name || 'N/A',
                tutor: batchJson.tutor?.full_name || 'Not Assigned',
                course: batchJson.Course?.name || 'N/A',
                start_date: batchJson.start_date,
                status: batchJson.status
            };
        });

        return {
            batches: formattedBatches,
            totalCount: count,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page)
        };
    }

    /**
     * Get a single batch by ID
     */
    async getBatchById(id) {
        return await Batch.findByPk(id, {
            include: [
                { model: Course, attributes: ['id', 'name'] },
                { model: Institution, attributes: ['id', 'name'] },
                { model: User, as: 'tutor', attributes: ['id', 'full_name'] },
                { 
                    model: BatchTutor, 
                    include: [{ model: User, attributes: ['id', 'full_name', 'email'] }]
                },
                { 
                    model: Enrollment, 
                    include: [{ model: Student, as: 'student', attributes: ['id', 'first_name', 'last_name', 'email'] }] 
                },
                { model: BatchPerformance }
            ]
        });
    }

    /**
     * Update a batch
     */
    async updateBatch(id, data) {
        const { enroll_students, ...batchData } = data;
        const batch = await Batch.findByPk(id);
        if (!batch) {
            throw new Error('Batch not found');
        }

        const transaction = await sequelize.transaction();
        try {
            await batch.update(batchData, { transaction });

            if (enroll_students !== undefined && Array.isArray(enroll_students)) {
                if (enroll_students.length > 0) {
                    const enrollments = enroll_students.map(studentId => ({
                        student_id: studentId,
                        batch_id: batch.id,
                        status: 'active'
                    }));
                    await Enrollment.bulkCreate(enrollments, { transaction, ignoreDuplicates: true });
                }
            }

            await transaction.commit();
        } catch (error) {
            if (transaction) await transaction.rollback();
            throw error;
        }

        return await this.getBatchById(id);
    }

    /**
     * Delete a batch
     */
    async deleteBatch(id) {
        const batch = await Batch.findByPk(id);
        if (!batch) {
            throw new Error('Batch not found');
        }
        await batch.destroy();
        return { message: 'Batch deleted successfully' };
    }

    /**
     * Assign a tutor to a batch
     */
    async assignTutor(batchId, tutorId, isPrimary = false) {
        const batch = await Batch.findByPk(batchId);
        if (!batch) throw new Error('Batch not found');

        const user = await User.findByPk(tutorId);
        if (!user) throw new Error('User not found');

        return await BatchTutor.create({
            batch_id: batchId,
            tutor_id: tutorId,
            is_primary: isPrimary
        });
    }

    /**
     * Get batch assignments
     */
    async getBatchAssignments(batchId) {
        return await BatchAssignment.findAll({
            where: { batch_id: batchId },
            include: [{ model: Assignment }]
        });
    }

    /**
     * Get batch performance
     */
    async getBatchPerformance(batchId) {
        return await BatchPerformance.findOne({
            where: { batch_id: batchId }
        });
    }

    /**
     * Get students enrolled in a batch
     */
    async getBatchStudents(batchId, query) {
        const { page = 1, limit = 10, status = 'active', search = '' } = query;
        const offset = (page - 1) * limit;

        const whereEnrollment = { batch_id: batchId };
        if (status !== 'all') {
            whereEnrollment.status = status;
        }

        const whereStudent = {};
        if (search) {
            whereStudent[Op.or] = [
                { first_name: { [Op.iLike]: `%${search}%` } },
                { last_name: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const { rows: enrollments, count } = await Enrollment.findAndCountAll({
            where: whereEnrollment,
            include: [{ 
                model: Student, 
                as: 'student',
                where: Object.keys(whereStudent).length ? whereStudent : undefined,
                attributes: ['id', 'first_name', 'last_name', 'email'] 
            }],
            limit,
            offset,
            order: [[{ model: Student, as: 'student' }, 'first_name', 'ASC']]
        });

        return {
            students: enrollments.map(e => ({
                id: e.student?.id,
                full_name: `${e.student?.first_name || ''} ${e.student?.last_name || ''}`.trim(),
                email: e.student?.email,
                enrollment_date: e.enrollment_date,
                status: e.status
            })),
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / limit)
        };
    }

    /**
     * Bulk Upload Students to Batch CSV
     */
    async bulkUploadStudentsToBatch(batchId, filePath) {
        return new Promise((resolve, reject) => {
            const studentIdsToEnroll = new Set();

            fs.createReadStream(filePath)
                .pipe(csvParser())
                .on('data', (row) => {
                    if (row.student_id) {
                        const numericId = parseInt(row.student_id.toString().replace(/[^0-9]/g, ''), 10);
                        if (!isNaN(numericId)) studentIdsToEnroll.add(numericId);
                    }
                })
                .on('end', async () => {
                    try {
                        const allIds = Array.from(studentIdsToEnroll);
                        if (allIds.length === 0) return reject(new Error('No valid student IDs found in CSV'));

                        const validStudents = await Student.findAll({
                            where: { id: { [Op.in]: allIds } }
                        });
                        const validIds = validStudents.map(s => s.id);

                        const enrollments = validIds.map(id => ({
                            student_id: id,
                            batch_id: batchId,
                            status: 'active'
                        }));

                        await Enrollment.bulkCreate(enrollments, { ignoreDuplicates: true });
                        
                        try { fs.unlinkSync(filePath); } catch (e) {}
                        
                        resolve({
                            processed_rows: allIds.length,
                            enrolled_count: validIds.length
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

    /**
     * Get overall stats
     */
    async getBatchStats() {
        const totalBatches = await Batch.count();
        const activeBatches = await Batch.count({ where: { status: 'active' } });
        const enrollmentCount = await Enrollment.count();
        const average = totalBatches > 0 ? (enrollmentCount / totalBatches).toFixed(1) : 0;
        
        return {
            totalBatches,
            activeBatches,
            averageStudentsPerBatch: parseFloat(average)
        };
    }
}

module.exports = new BatchService();
