const recentActivityService = require('../../services/institutionRep/recent-activity.service');

class RecentActivityController {
    /**
     * GET /api/v1/institution-rep/batches/:batchId/students/:studentId/recent-activity
     */
    async getRecentActivity(req, res, next) {
        try {
            const { batchId, studentId } = req.params;
            const institutionId = req.user.institution_id;

            if (!batchId || !studentId) {
                return res.status(400).json({
                    success: false,
                    message: 'batchId and studentId are required'
                });
            }

            const data = await recentActivityService.getRecentActivity(
                batchId, 
                studentId, 
                institutionId
            );

            res.status(200).json({
                success: true,
                data: data
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new RecentActivityController();
