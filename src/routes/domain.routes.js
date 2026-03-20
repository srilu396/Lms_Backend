const express = require('express');
const router = express.Router();
const domainController = require('../controllers/domain.controller');
const validate = require('../middlewares/validate');
const { createDomainSchema, updateDomainSchema } = require('../utils/validations/domain.validation');

// Stats
router.get('/stats', domainController.getDomainStats);

// CRUD
router.post('/', validate(createDomainSchema), domainController.createDomain);
router.get('/', domainController.getDomains);
router.get('/:id', domainController.getDomainById);
router.put('/:id', validate(updateDomainSchema), domainController.updateDomain);
router.delete('/:id', domainController.deleteDomain);

// Batches under domain
router.get('/:id/batches', domainController.getDomainBatches);

module.exports = router;
