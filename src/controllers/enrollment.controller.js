const enrollmentService = require('../services/enrollment.service');

class EnrollmentController {
    async enrollStudent(req, res) {
        try {
            const enrollment = await enrollmentService.enrollStudent(req.body);
            res.status(201).json({
                success: true,
                message: 'Student enrolled successfully',
                data: enrollment
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error enrolling student'
            });
        }
    }
}

module.exports = new EnrollmentController();
