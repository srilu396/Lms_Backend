'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable('institution_contacts');
    if (!tableDefinition.role) {
      await queryInterface.addColumn('institution_contacts', 'role', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('institution_contacts', 'role');
  }
};
