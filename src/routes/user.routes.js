const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const validate = require('../middlewares/validate');
const { createUserSchema, updateUserSchema, updateUserStatusSchema } = require('../utils/validations/user.validation');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);
router.use(roleMiddleware('admin'));

// CRUD endpoints for Users
router.post('/', validate(createUserSchema), userController.createUser);
router.get('/', userController.getUsers);
router.get('/stats', userController.getUserStats);
router.get('/:id', userController.getUserById);
router.put('/:id', validate(updateUserSchema), userController.updateUser);
router.patch('/:id/status', validate(updateUserStatusSchema), userController.updateUserStatus);
router.delete('/:id', userController.deleteUser);

module.exports = router;
