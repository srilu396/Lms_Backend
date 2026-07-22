'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('media_attachments', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      entity_type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      entity_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      media_type: {
        type: Sequelize.STRING(50),
        allowNull: false
      },
      url: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      order_num: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for efficient polymorphic and media queries
    await queryInterface.addIndex('media_attachments', ['entity_type', 'entity_id']);
    await queryInterface.addIndex('media_attachments', ['media_type']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('media_attachments');
  }
};
