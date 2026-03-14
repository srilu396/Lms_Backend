const batchService = require('../services/batch.service');

class BatchController {
    async createBatch(req, res) {
        try {
            const payload = { ...req.body };
            if (req.file) {
                payload.file_path = req.file.path;
            }
            const batch = await batchService.createBatch(payload);
            res.status(201).json({
                success: true,
                message: 'Batch created successfully',
                data: batch
            });
        } catch (error) {
            console.error('Error creating batch:', error);
            
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({
                    success: false,
                    message: error.errors[0].message || 'A batch with this information already exists'
                });
            }

            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error creating batch'
            });
        }
    }

    async getBatches(req, res) {
        try {
            const result = await batchService.getBatches(req.query);
            
            let message = 'Batches retrieved successfully';
            if (req.query.search && result.data.length === 0) {
                message = 'No batches found matching your search criteria.';
            }

            res.status(200).json({
                success: true,
                message: message,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Error getting batches:', error);
            res.status(500).json({
                success: false,
                message: 'Server error retrieving batches'
            });
        }
    }

    async getBatchById(req, res) {
        try {
            const batch = await batchService.getBatchById(req.params.id);
            res.status(200).json({
                success: true,
                message: 'Batch retrieved successfully',
                data: batch
            });
        } catch (error) {
            console.error('Error fetching batch by id:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error fetching batch'
            });
        }
    }

    async updateBatch(req, res) {
        try {
            const batch = await batchService.updateBatch(req.params.id, req.body);
            res.status(200).json({
                success: true,
                message: 'Batch updated successfully',
                data: batch
            });
        } catch (error) {
            console.error('Error updating batch:', error);

            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({
                    success: false,
                    message: error.errors[0].message || 'A record with this information already exists'
                });
            }

            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error updating batch'
            });
        }
    }

    async deleteBatch(req, res) {
        try {
            await batchService.deleteBatch(req.params.id);
            res.status(200).json({
                success: true,
                message: 'Operation successful',
                data: null
            });
        } catch (error) {
            console.error('Error deleting batch:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error deleting batch'
            });
        }
    }

    async getTotalCount(req, res) {
        try {
            const count = await batchService.getTotalCount();
            res.status(200).json({
                success: true,
                message: 'Total batches count retrieved',
                data: count
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving count'
            });
        }
    }

    async getActiveCount(req, res) {
        try {
            const count = await batchService.getActiveCount();
            res.status(200).json({
                success: true,
                message: 'Active batches count retrieved',
                data: count
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving active count'
            });
        }
    }

    async getAverageStudents(req, res) {
        try {
            const average = await batchService.getAverageStudents();
            res.status(200).json({
                success: true,
                message: 'Average students per batch retrieved',
                data: average
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error calculating average students per batch'
            });
        }
    }

    async getBatchStudents(req, res) {
        try {
            const result = await batchService.getBatchStudents(req.params.id, req.query);
            res.status(200).json({
                success: true,
                message: 'Batch students retrieved successfully',
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Error getting batch students:', error);
            res.status(500).json({
                success: false,
                message: 'Server error retrieving batch students'
            });
        }
    }

    async bulkUploadStudentsToBatch(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Please upload a valid CSV file'
                });
            }

            const result = await batchService.bulkUploadStudentsToBatch(req.params.id, req.file.path);
            res.status(201).json({
                success: true,
                message: 'Operation successful',
                data: result
            });
        } catch (error) {
            console.error('Error in bulk upload to batch:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Server error during bulk upload'
            });
        }
    }
}

module.exports = new BatchController();
