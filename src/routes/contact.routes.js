const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contact.controller');
const validate = require('../middlewares/validate');
const { createContactRequestSchema } = require('../utils/validations/contact.validation');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

// Public Contact Form Endpoint
router.post('/', validate(createContactRequestSchema), contactController.createContactRequest);

// Protected Admin Retrieval Endpoints
router.use(authMiddleware);
router.use(roleMiddleware('admin', 'institution_representative'));

router.get('/stats', contactController.getContactStats);
router.get('/', contactController.getContactRequests);
router.get('/:id', contactController.getContactRequestById);

module.exports = router;
