const express = require('express');
const router = express.Router();
const institutionController = require('../controllers/institution.controller');

// Create a new institution
router.post('/', institutionController.createInstitution);

// Get list of institutions with pagination and search
router.get('/', institutionController.getInstitutions);

// Get summary statistics
router.get('/stats', institutionController.getInstitutionStats);

// Get a single institution by ID
router.get('/:id', institutionController.getInstitutionById);

// Update an institution completely (including contacts)
router.put('/:id', institutionController.updateInstitution);

// Update institution status (activate / deactivate)
router.patch('/:id/status', institutionController.updateInstitutionStatus);

// Delete an institution
router.delete('/:id', institutionController.deleteInstitution);

module.exports = router;
