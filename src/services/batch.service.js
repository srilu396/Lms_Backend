const { Batch, Course, Institution, Enrollment, BatchTutor, BatchAssignment, Assignment, BatchPerformance, User, Student, Tutor, sequelize } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const csvParser = require('csv-parser');

class BatchService {
    /**
     * Create a new batch
     */
    async createBatch(data) {
        const { enroll_students, tutor_id, tutors, ...batchData } = data;
        const transaction = await sequelize.transaction();
        let batch;

        try {
            batch = await Batch.create(batchData, { transaction });
            const batchId = batch.id;

            // 1. Handle Tutors (BatchTutor Association)
            const tutorAssignments = [];
            if (tutor_id) {
                tutorAssignments.push({
                    batch_id: batchId,
                    tutor_id: tutor_id,
                    is_primary: true
                });
            }

            if (tutors && Array.isArray(tutors)) {
                tutors.forEach(tId => {
                    // Avoid duplicating if tutor_id is also in tutors array
                    if (tId !== tutor_id) {
                        tutorAssignments.push({
                            batch_id: batchId,
                            tutor_id: tId,
                            is_primary: false
                        });
                    }
                });
            }

            if (tutorAssignments.length > 0) {
                await BatchTutor.bulkCreate(tutorAssignments, { transaction });
            }

            // 2. Handle Students
            if (enroll_students && Array.isArray(enroll_students) && enroll_students.length > 0) {
                const enrollments = enroll_students.map(studentId => ({
                    student_id: studentId,
                    batch_id: batchId,
                    status: 'active'
                }));
                await Enrollment.bulkCreate(enrollments, { transaction, ignoreDuplicates: true });
            }

            await transaction.commit();
            
            // --- NOTIFICATION TRIGGERS ---
            try {
                const { createNotification, createNotificationsForMany } = require('../notifications/notification.service');
                
                // Trigger 1: Institution Rep
                if (batch.institution_id) {
                    const instRep = await User.findOne({ where: { role: 'institution_representative', institution_id: batch.institution_id } });
                    if (instRep) {
                        await createNotification({
                            userId: instRep.id,
                            role: 'institution_representative',
                            type: 'BATCH_CREATED',
                            title: 'New Batch Added',
                            message: `A new batch "${batch.name}" has been created for your institution.`,
                            referenceId: batch.id,
                            referenceType: 'batch'
                        });
                    }
                }

                // Trigger 5: Tutor Batch Allocated
                if (tutorAssignments && tutorAssignments.length > 0) {
                    const tutorIds = tutorAssignments.map(ta => ta.tutor_id);
                    const tutorsData = await Tutor.findAll({ where: { id: { [Op.in]: tutorIds } }, attributes: ['user_id'] });
                    const userIds = tutorsData.map(t => t.user_id).filter(id => id);
                    if (userIds.length > 0) {
                        await createNotificationsForMany({
                            userIds,
                            role: 'tutor',
                            type: 'BATCH_ALLOCATED_TUTOR',
                            title: 'New Batch Assigned to You',
                            message: `You have been assigned to teach "${batch.name}" starting ${batch.start_date || 'soon'}. Please review the course content.`,
                            referenceId: batch.id,
                            referenceType: 'batch'
                        });
                    }
                }

                // Trigger 6: Student Enrollment
                if (enroll_students && enroll_students.length > 0) {
                    const studentsData = await Student.findAll({ where: { id: { [Op.in]: enroll_students } }, attributes: ['user_id'] });
                    const userIds = studentsData.map(s => s.user_id).filter(id => id);
                    if (userIds.length > 0) {
                        const course = batch.course_id ? await Course.findByPk(batch.course_id) : null;
                        const courseName = course ? course.name : 'your course';
                        await createNotificationsForMany({
                            userIds,
                            role: 'student',
                            type: 'BATCH_ALLOCATED_STUDENT',
                            title: 'You Have Been Enrolled in a Batch',
                            message: `You have been enrolled in "${batch.name}". Your course "${courseName}" starts on ${batch.start_date || 'soon'}. Welcome!`,
                            referenceId: batch.id,
                            referenceType: 'batch'
                        });
                    }
                }
            } catch (err) {
                // Silent catch
            }
            // --- END NOTIFICATION TRIGGERS ---

        } catch (error) {
            if (transaction) await transaction.rollback();
            throw error;
        }

        try {
            return await this.getBatchById(batch.id);
        } catch (fetchError) {
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

        // tutor_id is not a column on batches — tutors are linked via batch_tutors junction table
        // Filtering by tutor_id is handled at a higher level if needed

        if (search) {
            whereClause.name = { [Op.iLike]: `%${search}%` };
        }

        const { rows: batches, count } = await Batch.findAndCountAll({
            where: whereClause,
            include: [
                { model: Course, attributes: ['id', 'name'] },
                { model: Institution, attributes: ['id', 'name'] },
                {
                    model: BatchTutor,
                    as: 'batchTutors',
                    include: [{ model: Tutor, attributes: ['id', 'full_name'] }],
                    required: false
                }
            ],
            limit,
            offset,
            order: [['created_at', 'DESC']],
            distinct: true
        });

        const formattedBatches = batches.map(batch => {
            const batchJson = batch.toJSON();
            // Get primary tutor name from batchTutors junction
            const primaryTutor = batchJson.batchTutors?.find(bt => bt.is_primary)?.Tutor
                || batchJson.batchTutors?.[0]?.Tutor
                || null;
            return {
                id: batchJson.id,
                batch_id: `#BATCH-${batchJson.id}`,
                batch_name: batchJson.name,
                institution_name: batchJson.Institution?.name || 'N/A',
                tutor: primaryTutor?.full_name || 'Not Assigned',
                course: batchJson.Course?.name || 'N/A',
                start_date: batchJson.start_date,
                status: batchJson.status,
                department: batchJson.department || 'N/A'
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
                { model: Institution, attributes: ['id', 'name'], required: false },
                {
                    model: BatchTutor,
                    as: 'batchTutors',
                    include: [{ model: Tutor, attributes: ['id', 'full_name', 'email'] }],
                    required: false
                },
                {
                    model: Enrollment,
                    include: [{ model: Student, as: 'student', attributes: ['id', 'first_name', 'last_name', 'email'] }],
                    required: false
                },
                { model: BatchPerformance, required: false }
            ]
        });
    }

    /**
     * Update a batch
     */
    async updateBatch(id, data) {
        const { enroll_students, tutor_id, tutors, ...batchData } = data;
        const batch = await Batch.findByPk(id);
        if (!batch) {
            throw new Error('Batch not found');
        }

        const transaction = await sequelize.transaction();
        try {
            await batch.update(batchData, { transaction });

            // 1. Sync Tutors if provided
            if (tutor_id !== undefined || tutors !== undefined) {
                // Delete existing assignments for a clean sync
                await BatchTutor.destroy({ where: { batch_id: id }, transaction });

                const tutorAssignments = [];
                if (tutor_id) {
                    tutorAssignments.push({
                        batch_id: id,
                        tutor_id: tutor_id,
                        is_primary: true
                    });
                }

                if (tutors && Array.isArray(tutors)) {
                    tutors.forEach(tId => {
                        if (tId !== tutor_id) {
                            tutorAssignments.push({
                                batch_id: id,
                                tutor_id: tId,
                                is_primary: false
                            });
                        }
                    });
                }

                if (tutorAssignments.length > 0) {
                    await BatchTutor.bulkCreate(tutorAssignments, { transaction });
                }
            }

            // 2. Handle Students
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
                { last_name: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } }
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
            order: [[{ model: Student, as: 'student' }, 'first_name', 'ASC']],
            distinct: true
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
                        
                        // --- NOTIFICATION TRIGGER 6 (Student Bulk Upload) ---
                        try {
                            if (validIds.length > 0) {
                                const { createNotificationsForMany } = require('../notifications/notification.service');
                                const studentsData = await Student.findAll({ where: { id: { [Op.in]: validIds } }, attributes: ['user_id'] });
                                const userIds = studentsData.map(s => s.user_id).filter(id => id);
                                if (userIds.length > 0) {
                                    const batchRecord = await Batch.findByPk(batchId);
                                    if (batchRecord) {
                                        const course = batchRecord.course_id ? await Course.findByPk(batchRecord.course_id) : null;
                                        const courseName = course ? course.name : 'your course';
                                        await createNotificationsForMany({
                                            userIds,
                                            role: 'student',
                                            type: 'BATCH_ALLOCATED_STUDENT',
                                            title: 'You Have Been Enrolled in a Batch',
                                            message: `You have been enrolled in "${batchRecord.name}". Your course "${courseName}" starts on ${batchRecord.start_date || 'soon'}. Welcome!`,
                                            referenceId: batchRecord.id,
                                            referenceType: 'batch'
                                        });
                                    }
                                }
                            }
                        } catch (err) {}
                        // --- END TRIGGER ---

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

    /**
     * Bulk Create Batches from CSV
     * Expected CSV format: name,course_id,department,start_date,end_date,institution_id
     */
    async bulkCreateBatchesFromCSV(filePath, defaultInstitutionId) {
        return new Promise((resolve, reject) => {
            const batchesToCreate = [];

            fs.createReadStream(filePath)
                .pipe(csvParser())
                .on('data', (row) => {
                    if (row.name) {
                        batchesToCreate.push({
                            name: row.name,
                            course_id: row.course_id ? parseInt(row.course_id) : null,
                            department: row.department || null,
                            start_date: row.start_date || null,
                            end_date: row.end_date || null,
                            institution_id: row.institution_id ? parseInt(row.institution_id) : defaultInstitutionId,
                            status: 'active'
                        });
                    }
                })
                .on('end', async () => {
                    try {
                        if (batchesToCreate.length === 0) return reject(new Error('No valid batch data found in CSV'));

                        const createdBatches = await Batch.bulkCreate(batchesToCreate);
                        
                        try { fs.unlinkSync(filePath); } catch (e) {}
                        
                        resolve({
                            processed_rows: batchesToCreate.length,
                            created_count: createdBatches.length
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
