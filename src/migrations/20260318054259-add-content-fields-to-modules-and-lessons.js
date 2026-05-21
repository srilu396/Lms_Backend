'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableModules = await queryInterface.describeTable('modules');
    const tableLessons = await queryInterface.describeTable('lessons');

    // Modules
    if (!tableModules.description) {
      await queryInterface.addColumn('modules', 'description', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
    if (!tableModules.image_url) {
      await queryInterface.addColumn('modules', 'image_url', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
    if (!tableModules.video_url) {
      await queryInterface.addColumn('modules', 'video_url', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    // Lessons
    if (!tableLessons.image_url) {
      await queryInterface.addColumn('lessons', 'image_url', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
    
    // Ensure ENUM values are correct for postgres (case sensitive check)
    // we use a try-catch because if they already exist it will fail
    try {
      await queryInterface.sequelize.query("ALTER TYPE \"enum_lessons_type\" ADD VALUE IF NOT EXISTS 'image'");
      await queryInterface.sequelize.query("ALTER TYPE \"enum_lessons_type\" ADD VALUE IF NOT EXISTS 'mixed'");
    } catch (e) {
      // Ignore if not postgres or other error
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Usually we don't remove if they existed before, but for a clean roll back:
    // This is optional since they were added 'if not exists'
  }
};
