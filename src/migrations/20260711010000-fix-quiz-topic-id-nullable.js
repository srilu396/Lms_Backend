'use strict';

/**
 * Guard Migration — Fix quizzes.topic_id nullable (belt-and-suspenders)
 *
 * The original make-topic-id-nullable.js was patched to skip if topic_id
 * doesn't exist. This guard migration handles any edge case where topic_id
 * still exists in quizzes after the normalization migration.
 *
 * If the normalization migration already handled this (via align-course-hierarchy),
 * this migration safely skips. Fully idempotent.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('quizzes');
    if (!tableDesc.topic_id) {
      // Already removed by normalization / align-course-hierarchy migration — skip.
      return;
    }

    // topic_id still exists — ensure it is nullable
    await queryInterface.changeColumn('quizzes', 'topic_id', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    // No meaningful rollback — if topic_id doesn't exist, nothing to do.
    const tableDesc = await queryInterface.describeTable('quizzes');
    if (!tableDesc.topic_id) {
      return;
    }
    // Restore NOT NULL if column exists (only applicable on old-hierarchy DBs)
    await queryInterface.changeColumn('quizzes', 'topic_id', {
      type: Sequelize.INTEGER,
      allowNull: false
    });
  }
};
