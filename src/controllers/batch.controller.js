const batchService = require('../services/batch.service');

class BatchController {
    /**
     * POST /batches
     */
    async createBatch(req, res) {
        try {
            const data = { ...req.body };
            if (req.file) data.file_path = req.file.path;
            
            // Note: Validation is done in middleware
            const newBatch = await batchService.createBatch(data);
            
            // If file was provided, trigger bulk upload
            if (data.file_path) {
                try {
                    await batchService.bulkUploadStudentsToBatch(newBatch.id, data.file_path);
                } catch (bulkError) {
                }
            }

            res.status(201).json({
                success: true,
                message: 'Batch created successfully',
                data: newBatch
            });
        } catch (error) {
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
            const { page, limit, search, status, institution_id, course_id, tutor_id } = req.query;
            const result = await batchService.getBatches({
                page, limit, search, status, institution_id, course_id, tutor_id
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
                return res.status(404).json({ success: false, message: 'Batch not found' });
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
            const updatedBatch = await batchService.updateBatch(id, req.body);
            res.status(200).json({
                success: true,
                message: 'Batch updated successfully',
                data: updatedBatch
            });
        } catch (error) {
            if (error.message === 'Batch not found') {
                return res.status(404).json({ success: false, message: error.message });
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
                return res.status(404).json({ success: false, message: error.message });
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
            if (!tutor_id) return res.status(400).json({ success: false, message: 'tutor_id is required' });
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
            const { page, limit, status, search } = req.query;
            const result = await batchService.getBatchStudents(id, { page, limit, status, search });
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
     * POST /batches/:id/students/bulk-upload
     */
    async bulkUploadStudentsToBatch(req, res) {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a valid CSV file' });
            const result = await batchService.bulkUploadStudentsToBatch(req.params.id, req.file.path);
            res.status(201).json({
                success: true,
                message: 'Bulk upload successful',
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

    /**
     * POST /batches/bulk-upload
     */
    async bulkCreateBatches(req, res) {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a valid CSV file' });
            
            // institution_id might come from req.body if provided by admin
            const defaultInstitutionId = req.body.institution_id || null;
            
            const result = await batchService.bulkCreateBatchesFromCSV(req.file.path, defaultInstitutionId);
            res.status(201).json({
                success: true,
                message: 'Batches created successfully',
                data: result
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
