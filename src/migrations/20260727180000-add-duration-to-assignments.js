'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('assignments');

    if (!tableDesc.duration) {
      await queryInterface.addColumn('assignments', 'duration', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('assignments');

    if (tableDesc.duration) {
      await queryInterface.removeColumn('assignments', 'duration');
    }
  }
};
