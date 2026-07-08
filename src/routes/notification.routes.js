const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notification.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

// Retrieve user's notifications
router.get('/', notificationController.getMyNotifications);

// Mark all notifications as read
router.get('/read-all', notificationController.markAllRead);

// Mark a single notification as read
router.get('/:notificationId/read', notificationController.markSingleRead);

module.exports = router;
