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
            next(error);
        }
    }

    /**
     * Get monitoring list (at-risk and warning students)
     */
    async getMonitoringList(req, res, next) {
        try {
            const institutionId = req.user.institution_id;
            const filters = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 10,
                search: req.query.search || '',
                batch_id: req.query.batch_id || 'all'
            };

            const result = await dashboardService.getMonitoringList(institutionId, filters);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            if (error.message === 'Unauthorized batch access') {
                return res.status(403).json({ success: false, message: error.message });
            }
            next(error);
        }
    }
}

module.exports = new DashboardController();
