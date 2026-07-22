'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('topic_progress', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      student_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      topic_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'topics',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      enrollment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'enrollments',
          key: 'id'
        },
        onDelete: 'CASCADE'
      },
      is_completed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      completed_at: {
        type: Sequelize.DATE
      },
      last_accessed: {
        type: Sequelize.DATE
      }
    });

    await queryInterface.addConstraint('topic_progress', {
      fields: ['student_id', 'topic_id', 'enrollment_id'],
      type: 'unique',
      name: 'uq_topic_progress'
    });

    await queryInterface.addIndex('topic_progress', ['student_id'], {
      name: 'idx_topic_progress_student'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('topic_progress');
  }
};
