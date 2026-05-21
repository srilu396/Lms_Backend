const express = require('express');
const router = express.Router();
const batchDetailsController = require('../../controllers/institutionRep/batch-details.controller');
const institutionRepAuth = require('../../middlewares/institutionRepAuth');

/**
 * @route   GET /api/v1/institution-rep/batches/:batchId/overview
 * @desc    Get top section data (batch header + stats cards) for a batch
 * @access  Private (Institution Representative)
 */
router.get('/:batchId/overview', institutionRepAuth, batchDetailsController.getBatchOverview);

module.exports = router;
