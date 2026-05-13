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

module.exports = router;
