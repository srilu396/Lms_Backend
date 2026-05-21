const batchDetailsService = require('../../services/institutionRep/batch-details.service');

class BatchDetailsController {
    /**
     * GET /api/v1/institution-rep/batches/:batchId/overview
     */
    async getBatchOverview(req, res, next) {
        try {
            const { batchId } = req.params;
            const institutionId = req.user.institution_id;

            const data = await batchDetailsService.getBatchOverview(batchId, institutionId);

            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new BatchDetailsController();
