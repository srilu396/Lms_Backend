const gradeDistributionService = require('../../services/institutionRep/grade-distribution.service');

class GradeDistributionController {
    /**
     * GET /api/v1/institution-rep/batches/:batchId/grade-distribution
     * Returns grade distribution buckets for a batch
     */
    async getGradeDistribution(req, res) {
        try {
            const { batchId } = req.params;
            const institutionId = req.user.institution_id;

            const data = await gradeDistributionService.getGradeDistribution(batchId, institutionId);

            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('getGradeDistribution controller error:', error);
            const statusCode = error.statusCode || 500;
            return res.status(statusCode).json({
                success: false,
                message: error.message || 'Internal Server Error'
            });
        }
    }
}

module.exports = new GradeDistributionController();
