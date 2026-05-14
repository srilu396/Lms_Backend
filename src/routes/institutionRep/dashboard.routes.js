const express = require('express');
const router = express.Router();
const dashboardController = require('../../controllers/institutionRep/dashboard.controller');
const institutionRepAuth = require('../../middlewares/institutionRepAuth');

/**
 * @route   GET /api/v1/institution-rep/dashboard/stats
 * @desc    Get dashboard KPI cards and stats for the institution
 * @access  Private (Institution Representative)
 */
router.get('/stats', institutionRepAuth, dashboardController.getDashboardStats);
router.get('/monitoring-list', institutionRepAuth, dashboardController.getMonitoringList);

module.exports = router;
