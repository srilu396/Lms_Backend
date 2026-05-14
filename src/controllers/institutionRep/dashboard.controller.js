const dashboardService = require('../../services/institutionRep/dashboard.service');

class DashboardController {
    /**
     * Get dashboard stats for the institution
     */
    async getDashboardStats(req, res, next) {
        try {
            // institution_id is attached to req.user by institutionRepAuth middleware
            const institutionId = req.user.institution_id;
            
            const stats = await dashboardService.getStats(institutionId);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            next(error);
        }
    }
}

module.exports = new DashboardController();
