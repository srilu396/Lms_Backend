const express = require('express');
const router = express.Router();
const institutionController = require('../controllers/institution.controller');

// Search endpoint for institutions
router.get('/search', institutionController.searchInstitutions);

module.exports = router;
