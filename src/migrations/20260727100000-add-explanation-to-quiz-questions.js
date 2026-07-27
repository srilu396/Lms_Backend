'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('quiz_questions');

    if (!tableDesc.explanation) {
      await queryInterface.addColumn('quiz_questions', 'explanation', {
        type: Sequelize.TEXT,
        allowNull: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('quiz_questions');

    if (tableDesc.explanation) {
      await queryInterface.removeColumn('quiz_questions', 'explanation');
    }
  }
};
