const tutorPortalService = require('../services/tutor-portal.service');

class TutorPortalController {

    // GET /tutor-portal/stats
    // Returns the 4 overview card values for the tutor dashboard
    async getStats(req, res, next) {
        try {
            const stats = await tutorPortalService.getStatsData(req.user);

            res.status(200).json({
                success: true,
                message: 'Tutor stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/dashboard
    // Returns paginated, filterable batch list for the tutor's Batch Management table
    async getDashboard(req, res, next) {
        try {
            const { page, limit, search, status } = req.query;

            const dashboardData = await tutorPortalService.getDashboardData(req.user, {
                page,
                limit,
                search,
                status
            });

            res.status(200).json({
                success: true,
                message: 'Tutor dashboard retrieved successfully',
                data: dashboardData
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/batch/:batchId/course
    // Returns the nested course structure (Modules→Topics→Lessons) for a batch
    async getBatchCourse(req, res, next) {
        try {
            const { batchId } = req.params;
            const courseData = await tutorPortalService.getBatchCourseStructure(
                req.user,
                batchId
            );

            res.status(200).json({
                success: true,
                message: 'Batch course structure retrieved successfully',
                data: courseData
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new TutorPortalController();
