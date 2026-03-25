const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const validate = require('../middlewares/validate');
const { adminCreateUserSchema } = require('../utils/validations/auth.validation');

router.use(authMiddleware);
router.use(roleMiddleware('admin'));

router.post('/create-user', validate(adminCreateUserSchema), adminController.createUser);

module.exports = router;
