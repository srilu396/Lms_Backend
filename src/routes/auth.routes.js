const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const rateLimit = require('express-rate-limit');
const validate = require('../middlewares/validate');
const { loginSchema } = require('../utils/validations/auth.validation');

// Rate limiting for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs for auth routes
    message: { success: false, message: 'Too many authentication attempts from this IP, please try again after 15 minutes' }
});

router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh-token', authLimiter, authController.refreshToken);
router.post('/logout', authController.logout);

module.exports = router;
