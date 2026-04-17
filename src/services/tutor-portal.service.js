const {
    Batch,
    Course,
    Enrollment,
    User,
    Module,
    Topic,
    Lesson,
    BatchPerformance,
    BatchTutor,
    Quiz,
    Tutor,
    AttendanceSession,
    StudentAttendance,
    Student
} = require('../models');
const { Op } = require('sequelize');

class TutorPortalService {

    /**
     * Helper to resolve the Tutor ID (business entity) from the User object (auth entity).
     * Senior Pattern: Separation of Auth User (ID 40) and Business Tutor (ID 14).
     */
    async _getTutorId(user) {
        if (!user) throw { statusCode: 401, message: 'User not authenticated' };
        
        const tutor = await Tutor.findOne({
            where: { email: user.email },
            attributes: ['id']
        });

        if (!tutor) {
            throw { statusCode: 404, message: 'No tutor profile found for this user email.' };
        }

        return tutor.id;
    }

    // ─── 1. Stats API (Overview Cards) ──────────────────────────────────────────
    async getStatsData(user) {
        const tutorId = await this._getTutorId(user);
        const tId = String(tutorId);
        // Total batches assigned to this tutor via batch_tutors junction table
        const totalAssignedBatches = await BatchTutor.count({
            where: { tutor_id: tId }
        });

        // Get all batch IDs for this tutor to count their students
        const tutorBatchRows = await BatchTutor.findAll({
            where: { tutor_id: tId },
            attributes: ['batch_id']
        });
        const tutorBatchIds = tutorBatchRows.map(row => row.batch_id);

        // Total students enrolled in those batches (active)
        const totalStudents = tutorBatchIds.length > 0
            ? await Enrollment.count({
                where: {
                    batch_id: { [Op.in]: tutorBatchIds },
                    status: 'active'
                }
            })
            : 0;

        // Placeholder — extend with Assignments / Session tables when ready
        const pendingEvaluations = 0;
        const todaySessions = 0;

        return {
            total_assigned_batches: totalAssignedBatches,
            total_students: totalStudents,
            pending_evaluations: pendingEvaluations,
            today_sessions: todaySessions
        };
    }

    // ─── 2. Dashboard API (Batches List) ────────────────────────────────────────
    async getDashboardData(user, filters = {}) {
        const tutorId = await this._getTutorId(user);
        const { page = 1, limit = 10, search = '', status } = filters;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        // Security: Ensure tutorId is clean (string for BIGINT comparisons)
        const tId = String(tutorId);

        // Step 1: Resolve batch IDs assigned to this tutor via junction table
        const tutorBatchRows = await BatchTutor.findAll({
            where: { tutor_id: tId },
            attributes: ['batch_id']
        });
        const tutorBatchIds = tutorBatchRows.map(row => row.batch_id);

        if (tutorBatchIds.length === 0) {
            return {
                total_items: 0,
                total_pages: 0,
                current_page: parseInt(page, 10),
                items_per_page: parseInt(limit, 10),
                data: []
            };
        }

        // Step 2: Build where clause
        const whereClause = {
            id: { [Op.in]: tutorBatchIds }
        };

        if (status) {
            whereClause.status = status;
        }

        if (search) {
            whereClause.name = { [Op.iLike]: `%${search}%` };
        }

        // Step 3: Fetch paginated batches with related data
        const { count, rows: batches } = await Batch.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Course,
                    attributes: ['id', 'name']
                },
                {
                    model: BatchPerformance,
                    attributes: ['overall_progress', 'completion_rate'],
                    required: false
                }
            ],
            limit: parseInt(limit, 10),
            offset,
            order: [['created_at', 'DESC']],
            distinct: true
        });

        // Step 4: Enrich each batch with student count
        const batchData = await Promise.all(
            batches.map(async (batch) => {
                const studentCount = await Enrollment.count({
                    where: {
                        batch_id: batch.id,
                        status: 'active'
                    }
                });

                return {
                    id: batch.id,
                    batch_name: batch.name,
                    status: batch.status,
                    start_date: batch.start_date,
                    end_date: batch.end_date,
                    course: batch.Course
                        ? { id: batch.Course.id, name: batch.Course.name }
                        : null,
                    total_students: studentCount,
                    progress_percentage: batch.BatchPerformance
                        ? parseFloat(batch.BatchPerformance.overall_progress)
                        : 0,
                    completion_percentage: batch.BatchPerformance
                        ? parseFloat(batch.BatchPerformance.completion_rate)
                        : 0
                };
            })
        );

        return {
            total_items: count,
            total_pages: Math.ceil(count / parseInt(limit, 10)),
            current_page: parseInt(page, 10),
            items_per_page: parseInt(limit, 10),
            data: batchData
        };
    }

    // ─── 3. View Batch Course Structure ─────────────────────────────────────────
    async getBatchCourseStructure(user, batchId) {
        const tutorId = await this._getTutorId(user);
        const role = user.role;

        // Verify the batch exists
        const batch = await Batch.findByPk(batchId, {
            include: [
                {
                    model: Course,
                    attributes: ['id', 'name', 'description']
                },
                {
                    model: BatchPerformance,
                    attributes: ['overall_progress'],
                    required: false
                }
            ]
        });

        if (!batch) {
            throw { statusCode: 404, message: 'Batch not found' };
        }

        // Authorization: tutors can only access their own assigned batches
        if (role !== 'admin') {
            const isAssigned = await BatchTutor.findOne({
                where: { batch_id: batchId, tutor_id: tutorId }
            });
            if (!isAssigned) {
                throw { statusCode: 403, message: 'Access denied. You are not assigned to this batch.' };
            }
        }

        if (!batch.course_id) {
            throw { statusCode: 404, message: 'No course is assigned to this batch yet.' };
        }

        // Fetch deep nested course structure
        const courseStructure = await Course.findByPk(batch.course_id, {
            attributes: ['id', 'name', 'description'],
            include: [
                {
                    model: Module,
                    as: 'modules',
                    attributes: ['id', 'name', 'order_num', 'description'],
                    include: [
                        {
                            model: Topic,
                            as: 'topics',
                            attributes: ['id', 'name', 'order_num'],
                            include: [
                                {
                                    model: Lesson,
                                    as: 'lessons',
                                    attributes: ['id', 'name', 'order_num', 'type', 'duration_minutes']
                                },
                                {
                                    model: Quiz,
                                    as: 'quizzes',
                                    attributes: ['id', 'name'],
                                    required: false
                                }
                            ],
                            order: [['order_num', 'ASC']]
                        }
                    ],
                    order: [['order_num', 'ASC']]
                }
            ]
        });

        return {
            batch_id: batch.id,
            batch_name: batch.name,
            batch_progress: batch.BatchPerformance
                ? parseFloat(batch.BatchPerformance.overall_progress)
                : 0,
            course_structure: courseStructure
        };
    }

    // ─── 4. Attendance API ──────────────────────────────────────────────────────
    
    /**
     * GET /api/v1/tutor-portal/batch/:batchId/stats
     * Returns attendance statistics (Total, Present, Absent, Late) for a specific batch and date.
     */
    async getBatchAttendanceStats(user, batchId, filters = {}) {
        const tutorId = await this._getTutorId(user);
        const { date } = filters;
        const sessionDate = date || new Date().toISOString().split('T')[0];

        // Security check
        const isAssigned = await BatchTutor.findOne({
            where: { batch_id: batchId, tutor_id: tutorId }
        });
        if (!isAssigned) {
            throw { statusCode: 403, message: 'Access denied. You are not assigned to this batch.' };
        }

        // 1. Find session
        let session = await AttendanceSession.findOne({
            where: { batch_id: batchId, session_date: sessionDate }
        });

        if (!session) {
            const totalStudents = await Enrollment.count({
                where: { batch_id: batchId, status: 'active' }
            });
            return {
                total_students: totalStudents,
                present_students: 0,
                absent_students: 0,
                late_students: 0
            };
        }

        // 2. Calculate Stats
        const allEnrollments = await Enrollment.findAll({
            where: { batch_id: batchId, status: 'active' },
            include: [
                {
                    model: StudentAttendance,
                    as: 'attendances',
                    where: { session_id: session.id },
                    required: false
                }
            ]
        });

        const stats = {
            total_students: allEnrollments.length,
            present: 0,
            absent: 0,
            late: 0
        };

        allEnrollments.forEach(en => {
            const att = en.attendances && en.attendances[0];
            if (att) {
                const s = att.status.toLowerCase();
                if (s === 'present') stats.present++;
                else if (s === 'absent') stats.absent++;
                else if (s === 'late') stats.late++;
            }
        });

        return {
            total_students: stats.total_students,
            present_students: stats.present,
            absent_students: stats.absent,
            late_students: stats.late
        };
    }

    /**
     * GET /api/v1/tutor-portal/batch/:batchId/students
     * Returns paginated student list with attendance status for a date.
     */
    async getBatchStudentsForAttendance(user, batchId, filters = {}) {
        const tutorId = await this._getTutorId(user);
        const { date, page = 1, limit = 10, search = '', status } = filters;
        const sessionDate = date || new Date().toISOString().split('T')[0];
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        // Security check
        const isAssigned = await BatchTutor.findOne({
            where: { batch_id: batchId, tutor_id: tutorId }
        });
        if (!isAssigned) {
            throw { statusCode: 403, message: 'Access denied. You are not assigned to this batch.' };
        }

        // 1. Find or create session
        let session = await AttendanceSession.findOne({
            where: { batch_id: batchId, session_date: sessionDate }
        });

        if (!session) {
            session = await AttendanceSession.create({
                batch_id: batchId,
                session_date: sessionDate,
                session_name: `Session ${sessionDate}`
            });
        }

        // 2. Paginated fetch with filters
        const enrollmentWhere = {
            batch_id: batchId,
            status: 'active'
        };

        const studentInclude = {
            model: Student,
            as: 'student',
            attributes: ['id', 'first_name', 'last_name', 'email'],
        };

        if (search) {
            studentInclude.where = {
                [Op.or]: [
                    { first_name: { [Op.iLike]: `%${search}%` } },
                    { last_name: { [Op.iLike]: `%${search}%` } },
                    { email: { [Op.iLike]: `%${search}%` } }
                ]
            };
        }

        const { count, rows: enrollments } = await Enrollment.findAndCountAll({
            where: enrollmentWhere,
            include: [
                studentInclude,
                {
                    model: StudentAttendance,
                    as: 'attendances',
                    where: { 
                        session_id: session.id,
                        ...(status && { status: status.toLowerCase() })
                    },
                    required: !!status
                }
            ],
            limit: parseInt(limit, 10),
            offset,
            distinct: true,
            subQuery: false,
            order: [[{ model: Student, as: 'student' }, 'first_name', 'ASC']]
        });

        const studentData = enrollments.map(en => ({
            student_id: en.student.id,
            first_name: en.student.first_name,
            last_name: en.student.last_name,
            email: en.student.email,
            attendance: en.attendances && en.attendances[0] ? {
                status: en.attendances[0].status,
                notes: en.attendances[0].notes,
                marked_at: en.attendances[0].marked_at
            } : null
        }));

        return {
            session_id: session.id,
            date: session.session_date,
            total_items: count,
            total_pages: Math.ceil(count / parseInt(limit, 10)),
            current_page: parseInt(page, 10),
            items_per_page: parseInt(limit, 10),
            data: studentData
        };
    }

    /**
     * POST /api/tutor/batch/:batchId/attendance
     * Marks attendance for students in a batch for a specific date.
     */
    async markBatchAttendance(user, batchId, data) {
        const tutorId = await this._getTutorId(user);
        const { date, attendance } = data;
        const sessionDate = date || new Date().toISOString().split('T')[0];

        if (!attendance || !Array.isArray(attendance)) {
            throw { statusCode: 400, message: 'Invalid attendance data format.' };
        }

        // Security check
        const isAssigned = await BatchTutor.findOne({
            where: { batch_id: batchId, tutor_id: tutorId }
        });
        if (!isAssigned) {
            throw { statusCode: 403, message: 'Access denied. You are not assigned to this batch.' };
        }

        // 1. Find or create session
        let session = await AttendanceSession.findOne({
            where: { batch_id: batchId, session_date: sessionDate }
        });

        if (!session) {
            session = await AttendanceSession.create({
                batch_id: batchId,
                session_date: sessionDate,
                session_name: `Session ${sessionDate}`
            });
        }

        const results = [];
        const errors = [];

        // 2. Mark attendance for each student
        for (const record of attendance) {
            const { studentId, status, notes } = record;
            
            try {
                // Find enrollment
                const enrollment = await Enrollment.findOne({
                    where: { student_id: studentId, batch_id: batchId }
                });

                if (!enrollment) {
                    errors.push({ studentId, error: 'Student not enrolled in this batch.' });
                    continue;
                }

                // Upsert StudentAttendance
                const [attendanceRecord, created] = await StudentAttendance.findOrCreate({
                    where: {
                        session_id: session.id,
                        student_id: studentId
                    },
                    defaults: {
                        enrollment_id: enrollment.id,
                        status: status.toLowerCase(),
                        notes: status.toLowerCase() === 'late' ? notes : null
                    }
                });

                if (!created) {
                    attendanceRecord.status = status.toLowerCase();
                    attendanceRecord.notes = status.toLowerCase() === 'late' ? notes : null;
                    attendanceRecord.marked_at = new Date();
                    await attendanceRecord.save();
                }

                results.push(attendanceRecord);
            } catch (err) {
                errors.push({ studentId, error: err.message });
            }
        }

        return {
            session_id: session.id,
            date: session.session_date,
            marked_count: results.length,
            errors: errors.length > 0 ? errors : undefined
        };
    }
}

module.exports = new TutorPortalService();
