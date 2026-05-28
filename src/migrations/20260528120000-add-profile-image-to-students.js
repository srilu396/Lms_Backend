'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDefinition = await queryInterface.describeTable('students');
    if (!tableDefinition.profile_image) {
      await queryInterface.addColumn('students', 'profile_image', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('students', 'profile_image');
  }
};
