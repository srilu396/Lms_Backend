const notificationService = require('../services/notification.service');

class NotificationController {
    // GET /api/v1/notifications
    async getMyNotifications(req, res, next) {
        try {
            const result = await notificationService.getMyNotifications(req.user.id, req.query);
            res.status(200).json({
                success: true,
                message: 'Notifications retrieved successfully',
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/v1/notifications/:notificationId/read
    async markSingleRead(req, res, next) {
        try {
            const notification = await notificationService.markAsRead(req.user.id, req.params.notificationId);
            res.status(200).json({
                success: true,
                message: 'Notification marked as read successfully',
                data: notification
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/v1/notifications/read-all
    async markAllRead(req, res, next) {
        try {
            const result = await notificationService.markAllAsRead(req.user.id);
            res.status(200).json({
                success: true,
                message: 'All notifications marked as read successfully',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new NotificationController();
