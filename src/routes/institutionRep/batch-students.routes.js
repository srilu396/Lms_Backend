const express = require('express');
const router = express.Router();
const batchStudentsController = require('../../controllers/institutionRep/batch-students.controller');
const institutionRepAuth = require('../../middlewares/institutionRepAuth');

/**
 * @route   GET /api/v1/institution-rep/batches/:batchId/students
 * @desc    Get paginated students list for a batch with performance metrics
 * @access  Private (Institution Representative)
 */
router.get('/:batchId/students', institutionRepAuth, batchStudentsController.getBatchStudents);

/**
 * @route   GET /api/v1/institution-rep/batches/:batchId/students/:studentId/profile
 * @desc    Get detailed student profile with stats for a batch
 * @access  Private (Institution Representative)
 */
router.get('/:batchId/students/:studentId/profile', institutionRepAuth, batchStudentsController.getStudentProfile);

module.exports = router;
