const batchStudentsService = require('../../services/institutionRep/batch-students.service');

class BatchStudentsController {
    /**
     * GET /api/v1/institution-rep/batches/:batchId/students
     */
    async getBatchStudents(req, res) {
        try {
            const { batchId } = req.params;
            const institutionId = req.user.institution_id;
            const { page, limit, search, status } = req.query;

            const data = await batchStudentsService.getBatchStudents(batchId, institutionId, {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 10,
                search,
                status
            });

            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('getBatchStudents controller error:', error);
            
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal Server Error';

            return res.status(statusCode).json({
                success: false,
                message
            });
        }
    }
}

module.exports = new BatchStudentsController();
