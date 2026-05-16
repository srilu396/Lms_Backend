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
router.get('/:batchId/students/:studentId/stats', institutionRepAuth, batchStudentsController.getStudentStats);

module.exports = router;
