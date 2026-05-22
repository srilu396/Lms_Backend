const express = require('express');
const router = express.Router();
const batchesController = require('../../controllers/institutionRep/batches.controller');
const institutionRepAuth = require('../../middlewares/institutionRepAuth');

/**
 * @route   GET /api/v1/institution-rep/batches
 * @desc    Get list of batches for the representative's institution
 * @access  Private (Institution Representative)
 */
router.get('/', institutionRepAuth, batchesController.getBatches);

/**
 * @route   GET /api/v1/institution-rep/batches/download
 * @desc    Download batch list as CSV or Excel
 * @access  Private (Institution Representative)
 */
router.get('/download', institutionRepAuth, batchesController.downloadBatches);



module.exports = router;
