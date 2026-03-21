'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add domain_id to assignments table
    await queryInterface.addColumn('assignments', 'domain_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'domains',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('assignments', 'domain_id');
  }
};
