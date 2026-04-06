const express = require('express');
const router = express.Router();
const checkRole = require('../middlewares/role.middleware');
const authMiddleware = require('../middlewares/auth.middleware');
const enrollmentController = require('../controllers/enrollment.controller');

// All routes require authentication
router.use(authMiddleware);

// Create an enrollment (Admin or optionally specific roles as needed)
router.post('/', checkRole('admin', 'student'), enrollmentController.enrollStudent);

// Get all enrollments with optional filtering by student_id, batch_id, status
router.get('/', checkRole('admin', 'tutor', 'student'), enrollmentController.getAllEnrollments);

// Get a specific enrollment by ID
router.get('/:id', checkRole('admin', 'tutor', 'student'), enrollmentController.getEnrollmentById);

// Update enrollment status (usually Admin or Tutor depending on logic)
router.patch('/:id/status', checkRole('admin'), enrollmentController.updateEnrollmentStatus);

// Delete an enrollment
router.delete('/:id', checkRole('admin'), enrollmentController.deleteEnrollment);

module.exports = router;
