const { Batch, Course, Institution, Enrollment, BatchTutor, BatchAssignment, Assignment, BatchPerformance, User, Student, Tutor, sequelize } = require('../models');
const { Op } = require('sequelize');
const fs = require('fs');
const csvParser = require('csv-parser');
const { createNotification, createNotificationsForMany } = require('./notification.service');

class BatchService {
    /**
     * Create a new batch
     */
    async createBatch(data) {
        const { enroll_students, tutor_id, tutors, ...batchData } = data;

        if (batchData.name) {
            const existingBatch = await Batch.findOne({ where: { name: batchData.name } });
            if (existingBatch) {
                const error = new Error('A batch with this name already exists.');
                error.statusCode = 409;
                throw error;
            }
        }

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

            // Trigger 1 — Institution Rep: New batch created
            try {
                if (batch.institution_id) {
                    const rep = await User.findOne({ where: { role: 'institution_representative', institution_id: batch.institution_id } });
                    if (rep) {
                        await createNotification({
                            userId: rep.id,
                            role: 'institution_representative',
                            type: 'BATCH_CREATED',
                            title: 'New Batch Added',
                            message: `A new batch "${batch.name}" has been created for your institution.`,
                            referenceId: batch.id,
                            referenceType: 'batch'
                        });
                    }
                }
            } catch (err) {
                // silent try-catch
            }

            // Trigger 2 — Tutor: New batch allocated
            try {
                if (tutor_id) {
                    const tutor = await Tutor.findByPk(tutor_id);
                    if (tutor) {
                        const tutorUser = await User.findOne({ where: { email: tutor.email } });
                        if (tutorUser) {
                            await createNotification({
                                userId: tutorUser.id,
                                role: 'tutor',
                                type: 'BATCH_ALLOCATED_TUTOR',
                                title: 'New Batch Assigned to You',
                                message: `You have been assigned to teach "${batch.name}" starting ${batch.start_date || 'N/A'}.`,
                                referenceId: batch.id,
                                referenceType: 'batch'
                            });
                        }
                    }
                }
            } catch (err) {
                // silent try-catch
            }
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
            attributes: {
                include: [
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM "enrollments"
                            WHERE "enrollments"."batch_id" = "Batch"."id" AND "enrollments"."status" = 'active'
                        )`),
                        'student_count'
                    ]
                ]
            },
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

// get all batches mappings 
        const formattedBatches = batches.map(batch => {
            const batchJson = batch.toJSON();
            const primaryTutor = batchJson.batchTutors?.find(bt => bt.is_primary)?.Tutor
                || batchJson.batchTutors?.[0]?.Tutor
                || null;
            return {
                id: batchJson.id,
                batch_id: `#BATCH-${batchJson.id}`,
                batch_name: batchJson.name,
                institution_id: batchJson.Institution?.id || batchJson.institution_id || null,
                institution_name: batchJson.Institution?.name || 'N/A',
                tutor: primaryTutor?.full_name || 'Not Assigned',
                course: batchJson.Course?.name || 'N/A',
                start_date: batchJson.start_date,
                status: batchJson.status,
                department: batchJson.department || 'N/A',
                student_count: parseInt(batchJson.student_count) || 0,
                completion_percentage: 0 // Mocked for now, depending on student course progression structure
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
        const batch = await Batch.findByPk(id, {
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

        if (!batch) return null;

        const batchJson = batch.toJSON();
        batchJson.institution_id = batchJson.Institution?.id || batchJson.institution_id || null;
        batchJson.institution_name = batchJson.Institution?.name || 'N/A';
        batchJson.completion_percentage = 0; // Mocked - dependent on student course topic progression structures 

        return batchJson;
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

        if (batchData.name && batchData.name !== batch.name) {
            const existingBatch = await Batch.findOne({ where: { name: batchData.name } });
            if (existingBatch) {
                const error = new Error('A batch with this name already exists.');
                error.statusCode = 409;
                throw error;
            }
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

        const studentWhere = {};
        if (search) {
            studentWhere[Op.or] = [
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
                where: Object.keys(studentWhere).length > 0 ? studentWhere : undefined,
                required: Object.keys(studentWhere).length > 0, // This inner join forces search query to work reliably 
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
                status: e.status,
                completion_percentage: 0 // Will replace dynamically if Progress is active
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

    /**
     * Get isolated stats for a specific batch based on student structure
     */
    async getSpecificBatchStats(batchId) {
        const totalStudents = await Enrollment.count({ where: { batch_id: batchId } });
        
        // Simulating completion numbers: Usually driven via Progress completion counts relative to course mapping structures
        // Placeholders implemented anticipating exact progress tracking logic
        const completedCourseCount = 0; 
        
        return {
            total_students: totalStudents,
            completed_course_count: completedCourseCount,
            not_completed_course_count: totalStudents - completedCourseCount
        };
    }

    /**
     * Bulk Create Batches from CSV
     * Expected CSV format: name,course,institution,instructor,start_date,end_date,enroll_students,status
     */
    async bulkCreateBatchesFromCSV(filePath, defaultInstitutionId) {
        return new Promise((resolve, reject) => {
            const rawRows = [];

            fs.createReadStream(filePath)
                .pipe(csvParser())
                .on('data', (row) => {
                    if (row.name) {
                        rawRows.push(row);
                    }
                })
                .on('end', async () => {
                    let transaction;
                    try {
                        if (rawRows.length === 0) throw new Error('No valid batch data found in CSV');

                        // Pre-fetch active entities
                        const activeInstitutions = await Institution.findAll({ where: { is_active: true } });
                        const activeCourses = await Course.findAll({ where: { status: 'active' } });
                        const activeInstructors = await Tutor.findAll({ where: { status: 'active' } });
                        const activeStudents = await Student.findAll({ where: { status: 'active' } });
                        const existingBatches = await Batch.findAll();

                        const institutionMap = new Map(activeInstitutions.map(i => [i.name.toLowerCase().trim(), i.id]));
                        const courseMap = new Map(activeCourses.map(c => [c.name.toLowerCase().trim(), c.id]));
                        const instructorMap = new Map(activeInstructors.map(i => [i.full_name.toLowerCase().trim(), i.id]));
                        
                        // To map students safely by institution
                        const getStudentId = (name, instId) => {
                            const nameLower = name.toLowerCase().trim();
                            const student = activeStudents.find(s => 
                                s.institution_id === instId && 
                                `${s.first_name} ${s.last_name || ''}`.toLowerCase().trim() === nameLower
                            );
                            return student ? student.id : null;
                        };

                        const batchesToCreateMap = new Map();

                        for (let i = 0; i < rawRows.length; i++) {
                            const row = rawRows[i];
                            const rowNum = i + 1;
                            const batchNameKey = row.name.toLowerCase().trim();

                            if (!batchesToCreateMap.has(batchNameKey)) {
                                // Validate Uniqueness
                                if (existingBatches.some(b => b.name.toLowerCase().trim() === batchNameKey)) {
                                    throw new Error(`Row ${rowNum}: Batch name '${row.name}' already exists.`);
                                }

                                // Resolve Institution
                                const instName = row.institution ? row.institution.toLowerCase().trim() : null;
                                const instId = instName ? institutionMap.get(instName) : defaultInstitutionId;
                                if (!instId) throw new Error(`Row ${rowNum}: Active institution '${row.institution}' not found.`);

                                // Resolve Course
                                const courseName = row.course ? row.course.toLowerCase().trim() : null;
                                const courseId = courseName ? courseMap.get(courseName) : null;
                                if (!courseId) throw new Error(`Row ${rowNum}: Active course '${row.course}' not found.`);

                                // Resolve Instructor
                                const instrcName = row.instructor ? row.instructor.toLowerCase().trim() : null;
                                const instructorId = instrcName ? instructorMap.get(instrcName) : null;
                                if (row.instructor && !instructorId) throw new Error(`Row ${rowNum}: Active instructor '${row.instructor}' not found.`);

                                // Parse Dates
                                let startDate = row.start_date ? new Date(row.start_date) : null;
                                let endDate = row.end_date ? new Date(row.end_date) : null;
                                if (startDate && isNaN(startDate.getTime())) throw new Error(`Row ${rowNum}: Invalid start_date.`);
                                if (endDate && isNaN(endDate.getTime())) throw new Error(`Row ${rowNum}: Invalid end_date.`);
                                if (startDate && endDate && endDate <= startDate) throw new Error(`Row ${rowNum}: end_date must be after start_date.`);

                                batchesToCreateMap.set(batchNameKey, {
                                    batchObj: {
                                        name: row.name,
                                        course_id: courseId,
                                        institution_id: instId,
                                        start_date: startDate,
                                        end_date: endDate,
                                        status: row.status || 'active'
                                    },
                                    instructorId,
                                    instId,
                                    studentIds: new Set()
                                });
                            }

                            const batchData = batchesToCreateMap.get(batchNameKey);

                            // Resolve Students
                            const studentName = row.enroll_student || row.enroll_students;
                            if (studentName) {
                                // Check if there are commas anyway, just in case they mixed formats
                                const names = studentName.split(',').map(n => n.trim()).filter(n => n);
                                for (const name of names) {
                                    const sId = getStudentId(name, batchData.instId);
                                    if (!sId) throw new Error(`Row ${rowNum}: Active student '${name}' not found for this institution.`);
                                    batchData.studentIds.add(sId);
                                }
                            }
                        }

                        const batchesToCreate = Array.from(batchesToCreateMap.values());

                        transaction = await sequelize.transaction();
                        let createdCount = 0;

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

                        try { fs.unlinkSync(filePath); } catch (e) {}

                        resolve({
                            processed_rows: rawRows.length,
                            created_count: createdCount
                        });

                    } catch (error) {
                        if (transaction) await transaction.rollback();
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
     * Link an assignment to a batch
     */
    async linkAssignmentToBatch(batchId, assignmentId, dueDate) {
        const batch = await Batch.findByPk(batchId);
        if (!batch) throw new Error('Batch not found');

        const assignment = await Assignment.findByPk(assignmentId);
        if (!assignment) throw new Error('Assignment not found');

        const [batchAssignment, created] = await BatchAssignment.findOrCreate({
            where: { batch_id: batchId, assignment_id: assignmentId },
            defaults: { due_date: dueDate || null }
        });

        if (!created && dueDate !== undefined) {
            batchAssignment.due_date = dueDate;
            await batchAssignment.save();
        }

        // Trigger 9 — Student: New assignment posted in batch
        try {
            const enrollments = await Enrollment.findAll({
                where: { batch_id: batchId, status: 'active' },
                include: [{ model: Student, as: 'student' }]
            });

            const studentEmails = enrollments.map(e => e.student?.email).filter(Boolean);
            if (studentEmails.length > 0) {
                const studentUsers = await User.findAll({
                    where: { email: { [Op.in]: studentEmails } }
                });
                const userIds = studentUsers.map(u => u.id);
                
                if (userIds.length > 0) {
                    const dueDateText = dueDate ? ` Due: ${dueDate}` : ' No deadline set.';
                    await createNotificationsForMany({
                        userIds,
                        role: 'student',
                        type: 'ASSIGNMENT_ADDED',
                        title: 'New Assignment Posted',
                        message: `A new assignment "${assignment.title}" has been posted in your batch "${batch.name}".${dueDateText}`,
                        referenceId: assignment.id,
                        referenceType: 'assignment'
                    });
                }
            }
        } catch (err) {
            // silent try-catch
        }

        return batchAssignment;
    }
}

module.exports = new BatchService();
