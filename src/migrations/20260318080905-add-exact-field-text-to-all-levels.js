'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add exact 'text' field to modules, topics, and lessons
    const tableModules = await queryInterface.describeTable('modules');
    if (!tableModules.text) {
      await queryInterface.addColumn('modules', 'text', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    const tableTopics = await queryInterface.describeTable('topics');
    if (!tableTopics.text) {
      await queryInterface.addColumn('topics', 'text', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    const tableLessons = await queryInterface.describeTable('lessons');
    if (!tableLessons.text) {
      await queryInterface.addColumn('lessons', 'text', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // await queryInterface.removeColumn('modules', 'text');
    // await queryInterface.removeColumn('topics', 'text');
    // await queryInterface.removeColumn('lessons', 'text');
  }
};
