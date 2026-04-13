'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable('tutors');
    if (!tableDefinition.profile_image) {
      await queryInterface.addColumn('tutors', 'profile_image', {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('tutors', 'profile_image');
  }
};
