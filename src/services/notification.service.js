const { Notification, User } = require('../models');

class NotificationService {
    /**
     * Get user's notifications (paginated)
     */
    async getMyNotifications(userId, query) {
        const { page = 1, limit = 20, is_read } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 20, 100);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const where = {
            recipient_user_id: userId
        };

        if (is_read !== undefined) {
            // handle string/boolean values for is_read
            where.is_read = is_read === 'true' || is_read === true;
        }

        const { count, rows } = await Notification.findAndCountAll({
            where,
            limit: parsedLimit,
            offset: offset,
            order: [['created_at', 'DESC']],
            include: [
                {
                    model: User,
                    as: 'Sender',
                    attributes: ['id', 'full_name', 'email', 'role']
                }
            ]
        });

        return {
            data: rows,
            pagination: {
                total: count,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(count / parsedLimit)
            }
        };
    }

    /**
     * Mark a single notification as read
     */
    async markAsRead(userId, notificationId) {
        const notification = await Notification.findOne({
            where: {
                id: notificationId,
                recipient_user_id: userId
            }
        });

        if (!notification) {
            const error = new Error('Notification not found');
            error.statusCode = 404;
            throw error;
        }

        if (!notification.is_read) {
            notification.is_read = true;
            notification.read_at = new Date();
            await notification.save();
        }

        return notification;
    }

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId) {
        const [updatedCount] = await Notification.update(
            {
                is_read: true,
                read_at: new Date()
            },
            {
                where: {
                    recipient_user_id: userId,
                    is_read: false
                }
            }
        );

        return {
            updated_count: updatedCount
        };
    }
}

async function createNotification({ userId, role, type, title, message, referenceId, referenceType }) {
    try {
        if (!userId) return null;
        return await Notification.create({
            recipient_user_id: userId,
            sender_user_id: null,
            type,
            title,
            message,
            reference_id: referenceId,
            reference_type: referenceType,
            is_read: false
        });
    } catch (error) {
        return null;
    }
}

async function createNotificationsForMany({ userIds, role, type, title, message, referenceId, referenceType }) {
    try {
        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) return;
        const chunkSize = 50;
        for (let i = 0; i < userIds.length; i += chunkSize) {
            const chunk = userIds.slice(i, i + chunkSize);
            await Promise.all(
                chunk.map(userId =>
                    createNotification({
                        userId,
                        role,
                        type,
                        title,
                        message,
                        referenceId,
                        referenceType
                    })
                )
            );
        }
    } catch (error) {
        // silent
    }
}

const serviceInstance = new NotificationService();
serviceInstance.createNotification = createNotification;
serviceInstance.createNotificationsForMany = createNotificationsForMany;

module.exports = serviceInstance;
