const dashboardService = require('../../services/institutionRep/dashboard.service');

class DashboardController {
    /**
     * GET /api/v1/institution-rep/dashboard/overview
     * Get dashboard overview for institution representative
     */
    async getOverview(req, res, next) {
        try {
            const institutionId = req.user.institution_id;
            
            const dashboardData = await dashboardService.getOverview(institutionId);

            res.json({
                success: true,
                data: dashboardData
            });
        } catch (error) {
            console.error('Dashboard Overview Error:', error);
            next(error);
        }
    }
}

module.exports = new DashboardController();
