const express = require('express');
const router = express.Router();
const institutionController = require('../controllers/institution.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);

const adminOnly = roleMiddleware('admin');
const adminAndRep = roleMiddleware('admin', 'institution_representative');

// Search endpoint for institutions
router.get('/search', institutionController.searchInstitutions);

// Lookup endpoint for active institutions (dropdowns)
router.get('/lookup', institutionController.getInstitutionLookup);

// Create a new institution
router.post('/', adminOnly, institutionController.createInstitution);

// Get list of institutions with pagination and search
router.get('/', institutionController.getInstitutions);

// Get summary statistics
router.get('/stats', institutionController.getInstitutionStats);

// Get a single institution by ID
router.get('/:id', institutionController.getInstitutionById);

// Update an institution completely (including contacts)
router.put('/:id', adminAndRep, institutionController.updateInstitution);

// Update institution status (activate / deactivate)
router.patch('/:id/status', adminOnly, institutionController.updateInstitutionStatus);

// Delete an institution
router.delete('/:id', adminOnly, institutionController.deleteInstitution);

module.exports = router;
