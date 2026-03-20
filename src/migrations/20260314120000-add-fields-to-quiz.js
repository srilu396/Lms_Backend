'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Add new columns to quizzes table
      const tableDescription = await queryInterface.describeTable('quizzes', { transaction });
      
      // Check if columns exist before adding
      if (!tableDescription.total_marks) {
        await queryInterface.addColumn('quizzes', 'total_marks', {
          type: Sequelize.INTEGER,
          allowNull: true
        }, { transaction });
      }

      if (!tableDescription.domain) {
        await queryInterface.addColumn('quizzes', 'domain', {
          type: Sequelize.JSONB,
          allowNull: true
        }, { transaction });
      }

      if (!tableDescription.tags) {
        await queryInterface.addColumn('quizzes', 'tags', {
          type: Sequelize.JSONB,
          allowNull: true
        }, { transaction });
      }

      if (!tableDescription.status) {
        await queryInterface.addColumn('quizzes', 'status', {
          type: Sequelize.ENUM('published', 'draft', 'scheduled'),
          defaultValue: 'draft',
          allowNull: false
        }, { transaction });
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const tableDescription = await queryInterface.describeTable('quizzes', { transaction });
      
      if (tableDescription.total_marks) {
        await queryInterface.removeColumn('quizzes', 'total_marks', { transaction });
      }
      
      if (tableDescription.domain) {
        await queryInterface.removeColumn('quizzes', 'domain', { transaction });
      }
      
      if (tableDescription.tags) {
        await queryInterface.removeColumn('quizzes', 'tags', { transaction });
      }
      
      if (tableDescription.status) {
        await queryInterface.removeColumn('quizzes', 'status', { transaction });
      }
    });
  }
};
