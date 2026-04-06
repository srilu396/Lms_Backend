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

    async getAllEnrollments(req, res) {
        try {
            const filters = {
                student_id: req.query.student_id,
                batch_id: req.query.batch_id,
                status: req.query.status
            };
            const enrollments = await enrollmentService.getAllEnrollments(filters);
            res.status(200).json({
                success: true,
                message: 'Enrollments retrieved successfully',
                data: enrollments
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error retrieving enrollments'
            });
        }
    }

    async getEnrollmentById(req, res) {
        try {
            const enrollment = await enrollmentService.getEnrollmentById(req.params.id);
            res.status(200).json({
                success: true,
                message: 'Enrollment retrieved successfully',
                data: enrollment
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error retrieving enrollment'
            });
        }
    }

    async updateEnrollmentStatus(req, res) {
        try {
            const enrollment = await enrollmentService.updateEnrollmentStatus(req.params.id, req.body.status);
            res.status(200).json({
                success: true,
                message: 'Enrollment status updated successfully',
                data: enrollment
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error updating enrollment status'
            });
        }
    }

    async deleteEnrollment(req, res) {
        try {
            await enrollmentService.deleteEnrollment(req.params.id);
            res.status(200).json({
                success: true,
                message: 'Enrollment deleted successfully'
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error deleting enrollment'
            });
        }
    }
}

module.exports = new EnrollmentController();
