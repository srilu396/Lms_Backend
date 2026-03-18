'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add columns to 'topics' table
    const tableTopics = await queryInterface.describeTable('topics');
    if (!tableTopics.description) {
      await queryInterface.addColumn('topics', 'description', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
    if (!tableTopics.image_url) {
      await queryInterface.addColumn('topics', 'image_url', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
    if (!tableTopics.video_url) {
      await queryInterface.addColumn('topics', 'video_url', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
    if (!tableTopics.url) {
      await queryInterface.addColumn('topics', 'url', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    // Add generic 'url' to 'modules' and 'lessons' as well
    const tableModules = await queryInterface.describeTable('modules');
    if (!tableModules.url) {
      await queryInterface.addColumn('modules', 'url', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    const tableLessons = await queryInterface.describeTable('lessons');
    if (!tableLessons.url) {
      await queryInterface.addColumn('lessons', 'url', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Not usually necessary for rolling forward, but included for completeness:
    // await queryInterface.removeColumn('topics', 'description');
    // await queryInterface.removeColumn('topics', 'image_url');
    // await queryInterface.removeColumn('topics', 'video_url');
    // await queryInterface.removeColumn('topics', 'url');
    // await queryInterface.removeColumn('modules', 'url');
    // await queryInterface.removeColumn('lessons', 'url');
  }
};
