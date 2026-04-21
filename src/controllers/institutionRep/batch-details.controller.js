const batchDetailsService = require('../../services/institutionRep/batch-details.service');

class BatchDetailsController {
    /**
     * GET /api/v1/institution-rep/batches/:batchId/overview
     */
    async getBatchOverview(req, res) {
        try {
            const { batchId } = req.params;
            const institutionId = req.user.institution_id;

            const data = await batchDetailsService.getBatchOverview(batchId, institutionId);

            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('getBatchOverview controller error:', error);
            
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal Server Error';

            return res.status(statusCode).json({
                success: false,
                message
            });
        }
    }
}

module.exports = new BatchDetailsController();
