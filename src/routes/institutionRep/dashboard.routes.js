const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/institutionRep/dashboard.controller');
const institutionRepAuth = require('../../middlewares/institutionRepAuth');

/**
 * @route   GET /api/v1/institution-rep/dashboard/overview
 * @desc    Get dashboard overview data
 * @access  Private (Institution Representative)
 */
router.get('/overview', institutionRepAuth, dashboardController.getOverview);

module.exports = router;
