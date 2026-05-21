const gradeDistributionService = require('../../services/institutionRep/grade-distribution.service');

/**
 * Controller for Grade Distribution Chart Data (Institution Representative)
 */
class GradeDistributionController {
    /**
     * GET /api/v1/institution-rep/batches/:batchId/grade-distribution
     * Protected by JWT and verified for institution access.
     */
    async getGradeDistribution(req, res, next) {
        try {
            const { batchId } = req.params;
            // Assumes req.user is populated by institutionRepAuth middleware
            const institutionId = req.user.institution_id;

            const distribution = await gradeDistributionService.getGradeDistribution(batchId, institutionId);

            return res.status(200).json({
                success: true,
                data: {
                    distribution
                }
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new GradeDistributionController();
