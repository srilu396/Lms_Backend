const { Batch, Course, Institution, Enrollment, BatchTutor, BatchAssignment, Assignment, BatchPerformance, User, sequelize } = require('../models');
const { Op } = require('sequelize');

class BatchService {
    /**
     * Create a new batch
     */
    async createBatch(data) {
        return await Batch.create(data);
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
            course_id = null
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

        if (search) {
            whereClause.name = { [Op.iLike]: `%${search}%` };
        }

        const { rows: batches, count } = await Batch.findAndCountAll({
            where: whereClause,
            include: [
                { model: Course, attributes: ['id', 'name'] },
                { model: Institution, attributes: ['id', 'name'] }
            ],
            limit,
            offset,
            order: [['created_at', 'DESC']]
        });

        return {
            batches,
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
                { 
                    model: BatchTutor, 
                    include: [{ model: User, attributes: ['id', 'full_name', 'email'] }]
                },
                { 
                    model: Enrollment, 
                    include: [{ model: User, attributes: ['id', 'full_name', 'email'] }] 
                }
            ]
        });
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
        const { page = 1, limit = 10, status = 'active' } = query;
        const offset = (page - 1) * limit;

        const whereClause = { batch_id: batchId };
        if (status !== 'all') {
            whereClause.status = status;
        }

        const { rows: enrollments, count } = await Enrollment.findAndCountAll({
            where: whereClause,
            include: [{ 
                model: User, 
                attributes: ['id', 'full_name', 'email', 'is_active'] 
            }],
            limit,
            offset,
            order: [[User, 'full_name', 'ASC']]
        });

        return {
            students: enrollments.map(e => ({
                id: e.User?.id,
                full_name: e.User?.full_name,
                email: e.User?.email,
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
     * Update a batch
     */
    async updateBatch(id, data) {
        const batch = await Batch.findByPk(id);
        if (!batch) {
            throw new Error('Batch not found');
        }
        return await batch.update(data);
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
     * Get batch statistics
     */
    async getBatchStats() {
        const totalBatches = await Batch.count();
        const activeBatches = await Batch.count({ where: { status: 'active' } });
        const completedBatches = await Batch.count({ where: { status: 'completed' } });
        
        return {
            totalBatches,
            activeBatches,
            completedBatches
        };
    }
}

module.exports = new BatchService();
