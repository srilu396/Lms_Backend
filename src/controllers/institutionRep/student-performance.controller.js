const studentPerformanceService = require('../../services/institutionRep/student-performance.service');

class StudentPerformanceController {
    /**
     * GET /api/v1/institution-rep/student-performance/summary
     */
    async getSummary(req, res) {
        try {
            const institutionId = req.user.institution_id;
            const term = req.query.term === 'past' ? 'past' : 'current';

            const data = await studentPerformanceService.getSummary(institutionId, term);

            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('getSummary controller error:', error);
            
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal Server Error';

            return res.status(statusCode).json({
                success: false,
                message
            });
        }
    }

    /**
     * GET /api/v1/institution-rep/student-performance/top-students
     */
    async getTopStudents(req, res) {
        try {
            const institutionId = req.user.institution_id;

            if (!institutionId) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: Institution ID could not be resolved from token.'
                });
            }

            const data = await studentPerformanceService.getTopStudents(institutionId);

            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('getTopStudents controller error:', error);
            
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal Server Error';

            return res.status(statusCode).json({
                success: false,
                message
            });
        }
    }
}

module.exports = new StudentPerformanceController();
