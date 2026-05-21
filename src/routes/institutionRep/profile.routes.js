const express = require('express');
const router = express.Router();
const institutionRepProfileController = require('../../controllers/institutionRep/profile.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

// Protect all routes with JWT and institution_representative role
router.use(authMiddleware);
router.use(roleMiddleware('institution_representative'));

// GET /api/v1/institution-rep/profile
router.get('/', institutionRepProfileController.getProfile);

module.exports = router;
