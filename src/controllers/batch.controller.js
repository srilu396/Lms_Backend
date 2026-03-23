const { z } = require('zod');
const batchService = require('../services/batch.service');

// Validations
const createBatchSchema = z.object({
    name: z.string().min(1, 'Batch name is required'),
    start_date: z.string().optional().nullable(),
    end_date: z.string().optional().nullable(),
    allocation_time: z.string().optional().nullable(),
    course_id: z.number().int('Invalid course ID').min(1, 'Course ID is required'),
    institution_id: z.number().int('Invalid institution ID').optional().nullable(),
    status: z.enum(['active', 'completed', 'cancelled']).optional().default('active')
});

const updateBatchSchema = createBatchSchema.partial();

class BatchController {
    /**
     * POST /batches
     */
    async createBatch(req, res) {
        try {
            const validatedData = createBatchSchema.parse(req.body);
            const newBatch = await batchService.createBatch(validatedData);
            res.status(201).json({
                success: true,
                message: 'Batch created successfully',
                data: newBatch
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: error.errors
                });
            }
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * GET /batches
     */
    async getBatches(req, res) {
        try {
            const { page, limit, search, status, institution_id, course_id } = req.query;
            const result = await batchService.getBatches({
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 10,
                search,
                status,
                institution_id: institution_id ? parseInt(institution_id) : null,
                course_id: course_id ? parseInt(course_id) : null
            });
            res.status(200).json({
                success: true,
                data: result.batches,
                meta: {
                    total: result.totalCount,
                    page: result.currentPage,
                    totalPages: result.totalPages,
                    limit: limit ? parseInt(limit) : 10
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * GET /batches/:id
     */
    async getBatchById(req, res) {
        try {
            const { id } = req.params;
            const batch = await batchService.getBatchById(id);
            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'Batch not found'
                });
            }
            res.status(200).json({
                success: true,
                data: batch
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * PUT /batches/:id
     */
    async updateBatch(req, res) {
        try {
            const { id } = req.params;
            const validatedData = updateBatchSchema.parse(req.body);
            const updatedBatch = await batchService.updateBatch(id, validatedData);
            res.status(200).json({
                success: true,
                message: 'Batch updated successfully',
                data: updatedBatch
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: error.errors
                });
            }
            if (error.message === 'Batch not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * DELETE /batches/:id
     */
    async deleteBatch(req, res) {
        try {
            const { id } = req.params;
            const result = await batchService.deleteBatch(id);
            res.status(200).json({
                success: true,
                message: result.message
            });
        } catch (error) {
            if (error.message === 'Batch not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * POST /batches/:id/tutors
     */
    async assignTutor(req, res) {
        try {
            const { id } = req.params;
            const { tutor_id, is_primary } = req.body;
            if (!tutor_id) {
                return res.status(400).json({ success: false, message: 'tutor_id is required' });
            }
            const result = await batchService.assignTutor(id, tutor_id, is_primary);
            res.status(201).json({
                success: true,
                message: 'Tutor assigned to batch successfully',
                data: result
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * GET /batches/:id/assignments
     */
    async getBatchAssignments(req, res) {
        try {
            const { id } = req.params;
            const assignments = await batchService.getBatchAssignments(id);
            res.status(200).json({
                success: true,
                data: assignments
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * GET /batches/:id/performance
     */
    async getBatchPerformance(req, res) {
        try {
            const { id } = req.params;
            const performance = await batchService.getBatchPerformance(id);
            res.status(200).json({
                success: true,
                data: performance
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * GET /batches/:id/students
     */
    async getBatchStudents(req, res) {
        try {
            const { id } = req.params;
            const { page, limit, status } = req.query;
            const result = await batchService.getBatchStudents(id, {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 10,
                status: status || 'active'
            });
            res.status(200).json({
                success: true,
                data: result.students,
                meta: {
                    total: result.total,
                    page: result.page,
                    limit: result.limit,
                    totalPages: result.totalPages
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * GET /batches/stats
     */
    async getBatchStats(req, res) {
        try {
            const stats = await batchService.getBatchStats();
            res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }
}

module.exports = new BatchController();
