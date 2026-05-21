const batchStudentsService = require('../../services/institutionRep/batch-students.service');

class BatchStudentsController {
    /**
     * GET /api/v1/institution-rep/batches/:batchId/students
     */
    async getBatchStudents(req, res, next) {
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
            next(error);
        }
    }

    /**
     * GET /api/v1/institution-rep/batches/:batchId/students/:studentId/stats
     */
    async getStudentStats(req, res, next) {
        try {
            const { batchId, studentId } = req.params;
            const institutionId = req.user.institution_id;

            const data = await batchStudentsService.getStudentStats(batchId, studentId, institutionId);

            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/v1/institution-rep/batches/:batchId/students/:studentId/academic-performance
     */
    async getAcademicPerformance(req, res, next) {
        try {
            const { batchId, studentId } = req.params;
            const institutionId = req.user.institution_id;
            const { page, limit, search, type } = req.query;

            const data = await batchStudentsService.getAcademicPerformance(batchId, studentId, institutionId, {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 10,
                search,
                type: type || 'all'
            });

            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new BatchStudentsController();
