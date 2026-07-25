const express = require('express');
const router = express.Router();
const domainController = require('../controllers/domain.controller');
const validate = require('../middlewares/validate');
const { createDomainSchema, updateDomainSchema, updateDomainStatusSchema } = require('../utils/validations/domain.validation');
const optionalAuth = require('../middlewares/optionalAuth.middleware');

router.use(optionalAuth);

// Stats
router.get('/stats', domainController.getDomainStats);
router.get('/lookup', domainController.getDomainLookup);

// CRUD
router.post('/', validate(createDomainSchema), domainController.createDomain);
router.get('/', domainController.getDomains);
router.get('/:id', domainController.getDomainById);
router.put('/:id', validate(updateDomainSchema), domainController.updateDomain);
router.patch('/:id/status', validate(updateDomainStatusSchema), domainController.updateDomainStatus);
router.delete('/:id', domainController.deleteDomain);

// Batches under domain
router.get('/:id/courses', domainController.getDomainBatches);

module.exports = router;

