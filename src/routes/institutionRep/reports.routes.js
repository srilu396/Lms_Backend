const express = require('express');
const router = express.Router();
const reportsController = require('../../controllers/institutionRep/reports.controller');
const institutionRepAuth = require('../../middlewares/institutionRepAuth');

/**
 * @route   GET /api/v1/institution-rep/reports/recent
 * @desc    Get dynamically generated list of available reports based on institution
 * @access  Private (Institution Representative)
 */
router.get('/recent', institutionRepAuth, reportsController.getRecentReports);

module.exports = router;
