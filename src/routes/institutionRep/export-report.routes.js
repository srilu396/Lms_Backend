const express = require('express');
const router = express.Router();
const exportReportController = require('../../controllers/institutionRep/export-report.controller');
const institutionRepAuth = require('../../middlewares/institutionRepAuth');

/**
 * @desc    Export full report for a specific batch
 * @route   GET /api/v1/institution-rep/batches/:batchId/export-report
 */
router.get('/:batchId/export-report', institutionRepAuth, exportReportController.exportReport);

module.exports = router;
