const express = require('express');
const router = express.Router();
const recentActivityController = require('../../controllers/institutionRep/recent-activity.controller');
const institutionRepAuth = require('../../middlewares/institutionRepAuth');

/**
 * @route   GET /api/v1/institution-rep/batches/:batchId/students/:studentId/recent-activity
 * @desc    Get recent assessment submissions and attendance log for a student
 * @access  Private (Institution Representative)
 */
router.get('/:batchId/students/:studentId/recent-activity', institutionRepAuth, recentActivityController.getRecentActivity);

module.exports = router;
