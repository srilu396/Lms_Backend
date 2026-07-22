'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('batches', 'domain_id', {
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

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('batches', 'domain_id');
  }
};
