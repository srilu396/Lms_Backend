const express = require('express');
const router = express.Router();
const { sequelize } = require('../db/connect');
const authMiddleware = require('../middlewares/auth.middleware');

// GET /api/v1/notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    if (role === 'admin') {
      return res.status(403).json({ success: false, message: 'Notifications not available for this role' });
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit) || 20, 1);
    const offset = (page - 1) * limit;
    
    let isReadFilter = '';
    if (req.query.is_read === 'true') {
      isReadFilter = 'AND is_read = true';
    } else if (req.query.is_read === 'false') {
      isReadFilter = 'AND is_read = false';
    }

    const [countsResult] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as unread_count
      FROM notifications 
      WHERE user_id = :userId
    `, { replacements: { userId } });

    const totalAll = parseInt(countsResult[0].total || 0);
    const unread_count = parseInt(countsResult[0].unread_count || 0);

    let total = totalAll;
    if (req.query.is_read === 'true') total = totalAll - unread_count;
    else if (req.query.is_read === 'false') total = unread_count;
    
    const totalPages = Math.ceil(total / limit);

    const [notifications] = await sequelize.query(`
      SELECT id, type, title, message, reference_id, reference_type, is_read, 
             TO_CHAR(created_at, 'Mon DD, YYYY • HH12:MI AM') as created_at
      FROM notifications 
      WHERE user_id = :userId ${isReadFilter}
      ORDER BY created_at DESC
      LIMIT :limit OFFSET :offset
    `, { replacements: { userId, limit, offset } });

    res.json({
      success: true,
      data: {
        unread_count,
        notifications,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/v1/notifications/:notificationId/read
router.patch('/:notificationId/read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = req.params.notificationId;

    const [result] = await sequelize.query(`
      UPDATE notifications 
      SET is_read = true 
      WHERE id = :notificationId AND user_id = :userId
      RETURNING id
    `, { replacements: { notificationId, userId } });

    if (!result || result.length === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found or access denied' });
    }

    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// PATCH /api/v1/notifications/read-all
router.patch('/read-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    await sequelize.query(`
      UPDATE notifications SET is_read = true WHERE user_id = :userId AND is_read = false
    `, { replacements: { userId } });

    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications read:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
