const { sequelize } = require('../db/connect');

/**
 * Inserts one row into the notifications table. Pure internal function — never sends HTTP responses.
 * Never throws — wrap in try-catch silently.
 */
async function createNotification({ userId, role, type, title, message, referenceId, referenceType }) {
  try {
    await sequelize.query(`
      INSERT INTO notifications (user_id, role, type, title, message, reference_id, reference_type, is_read, created_at)
      VALUES (:user_id, :role, :type, :title, :message, :reference_id, :reference_type, false, CURRENT_TIMESTAMP)
    `, {
      replacements: {
        user_id: userId,
        role: role,
        type: type,
        title: title,
        message: message,
        reference_id: referenceId || null,
        reference_type: referenceType || null
      }
    });
  } catch (error) {
    console.error('Error creating notification:', error.message);
  }
}

/**
 * Loops and creates one notification per userId. If userIds has 100+ entries, process in batches of 50.
 * Never throws — wrap in try-catch silently.
 */
async function createNotificationsForMany({ userIds, role, type, title, message, referenceId, referenceType }) {
  try {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) return;

    // Optimize: Deduplicate userIds
    const uniqueUserIds = [...new Set(userIds)];

    const batchSize = 50;
    for (let i = 0; i < uniqueUserIds.length; i += batchSize) {
      const batchUserIds = uniqueUserIds.slice(i, i + batchSize);
      
      const values = batchUserIds.map(() => '(?, ?, ?, ?, ?, ?, ?, false, CURRENT_TIMESTAMP)').join(', ');
      
      const replacements = [];
      batchUserIds.forEach(userId => {
        replacements.push(userId, role, type, title, message, referenceId || null, referenceType || null);
      });

      await sequelize.query(`
        INSERT INTO notifications (user_id, role, type, title, message, reference_id, reference_type, is_read, created_at)
        VALUES ${values}
      `, {
        replacements
      });
    }
  } catch (error) {
    console.error('Error creating notifications for many:', error.message);
  }
}

module.exports = {
  createNotification,
  createNotificationsForMany
};
