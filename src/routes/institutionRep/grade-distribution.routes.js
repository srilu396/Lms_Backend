const express = require('express');
const router = express.Router();
const gradeDistributionController = require('../../controllers/institutionRep/grade-distribution.controller');
const institutionRepAuth = require('../../middlewares/institutionRepAuth');

/**
 * @route   GET /api/v1/institution-rep/batches/:batchId/grade-distribution
 * @desc    Get grade distribution buckets (Fail/Average/Excellent)
 * @access  Private (Institution Representative)
 */
router.get('/:batchId/grade-distribution', institutionRepAuth, gradeDistributionController.getGradeDistribution);

module.exports = router;
