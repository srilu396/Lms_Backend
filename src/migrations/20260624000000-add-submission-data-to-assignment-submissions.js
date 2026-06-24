'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('assignment_submissions', 'submission_data', {
      type: Sequelize.JSON,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('assignment_submissions', 'submission_data');
  }
};
