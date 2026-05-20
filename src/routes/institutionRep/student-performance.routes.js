const express = require('express');
const router = express.Router();
const studentPerformanceController = require('../../controllers/institutionRep/student-performance.controller');
const institutionRepAuth = require('../../middlewares/institutionRepAuth');

/**
 * @route   GET /api/v1/institution-rep/student-performance/summary
 * @desc    Get student performance summary KPIs and distribution tiers
 * @access  Private (Institution Representative)
 */
router.get('/summary', institutionRepAuth, studentPerformanceController.getSummary);

/**
 * @route   GET /api/v1/institution-rep/student-performance/top-students
 * @desc    Get top 10 students by average quiz score
 * @access  Private (Institution Representative)
 */
router.get('/top-students', institutionRepAuth, studentPerformanceController.getTopStudents);

module.exports = router;
