'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const tableDescription = await queryInterface.describeTable('quizzes', { transaction });
      
      if (!tableDescription.is_published) {
        await queryInterface.addColumn('quizzes', 'is_published', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false
        }, { transaction });
      }

      if (!tableDescription.shuffle_questions) {
        await queryInterface.addColumn('quizzes', 'shuffle_questions', {
          type: Sequelize.BOOLEAN,
          defaultValue: false,
          allowNull: false
        }, { transaction });
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const tableDescription = await queryInterface.describeTable('quizzes', { transaction });
      
      if (tableDescription.is_published) {
        await queryInterface.removeColumn('quizzes', 'is_published', { transaction });
      }
      
      if (tableDescription.shuffle_questions) {
        await queryInterface.removeColumn('quizzes', 'shuffle_questions', { transaction });
      }
    });
  }
};
