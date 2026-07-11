'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add content column to media_attachments
    await queryInterface.addColumn('media_attachments', 'content', {
      type: Sequelize.TEXT,
      allowNull: true
    });
    // Alter url column to be nullable
    await queryInterface.changeColumn('media_attachments', 'url', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('media_attachments', 'content');
    await queryInterface.changeColumn('media_attachments', 'url', {
      type: Sequelize.TEXT,
      allowNull: false
    });
  }
};
