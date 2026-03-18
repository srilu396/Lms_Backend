'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add 'content_text' to 'modules' and 'topics'
    // 'lessons' already has 'content_text'
    
    const tableModules = await queryInterface.describeTable('modules');
    if (!tableModules.content_text) {
      await queryInterface.addColumn('modules', 'content_text', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }

    const tableTopics = await queryInterface.describeTable('topics');
    if (!tableTopics.content_text) {
      await queryInterface.addColumn('topics', 'content_text', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    // await queryInterface.removeColumn('modules', 'content_text');
    // await queryInterface.removeColumn('topics', 'content_text');
  }
};
