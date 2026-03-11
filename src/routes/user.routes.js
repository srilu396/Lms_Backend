const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const validate = require('../middlewares/validate');
const { createUserSchema, updateUserSchema } = require('../utils/validations/user.validation');

// CRUD endpoints for Users
router.post('/', validate(createUserSchema), userController.createUser);
router.get('/', userController.getUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', validate(updateUserSchema), userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
