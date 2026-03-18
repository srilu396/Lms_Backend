'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop existing tables safely to avoid FK issues with other existing tables not in this scope, if we drop them. 
    // In order to not break anything out of scope and since it's asked to 'create migrations', we do it forcefully or conditionally
    await queryInterface.createTable('courses', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      thumbnail_url: { type: Sequelize.STRING },
      instructor_id: { type: Sequelize.INTEGER },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable('modules', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      course_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'courses', key: 'id' }, onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      order_num: { type: Sequelize.INTEGER, allowNull: false },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable('topics', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      module_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'modules', key: 'id' }, onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING, allowNull: false },
      order_num: { type: Sequelize.INTEGER, allowNull: false },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable('lessons', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      topic_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'topics', key: 'id' }, onDelete: 'CASCADE' },
      title: { type: Sequelize.STRING, allowNull: false },
      content_text: { type: Sequelize.TEXT },
      video_url: { type: Sequelize.STRING },
      duration_minutes: { type: Sequelize.INTEGER },
      type: { type: Sequelize.ENUM('video', 'text', 'quiz'), allowNull: false, defaultValue: 'text' },
      order_num: { type: Sequelize.INTEGER, allowNull: false },
      created_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable('enrollments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      student_id: { type: Sequelize.INTEGER, allowNull: false },
      course_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'courses', key: 'id' }, onDelete: 'CASCADE' },
      enrolled_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    await queryInterface.createTable('student_progress', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      student_id: { type: Sequelize.INTEGER, allowNull: false },
      lesson_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'lessons', key: 'id' }, onDelete: 'CASCADE' },
      module_id: { type: Sequelize.INTEGER, allowNull: true, references: { model: 'modules', key: 'id' }, onDelete: 'CASCADE' },
      course_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'courses', key: 'id' }, onDelete: 'CASCADE' },
      is_completed: { type: Sequelize.BOOLEAN, defaultValue: false },
      completed_at: { type: Sequelize.DATE }
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('student_progress');
    await queryInterface.dropTable('enrollments');
    await queryInterface.dropTable('lessons');
    await queryInterface.dropTable('topics');
    await queryInterface.dropTable('modules');
    await queryInterface.dropTable('courses');
  }
};
