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
    Tutor
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
}

module.exports = new TutorPortalService();
