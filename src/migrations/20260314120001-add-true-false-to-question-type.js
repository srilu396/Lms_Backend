'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Update the enum type in quiz_questions table
      try {
        // For PostgreSQL
        await queryInterface.sequelize.query(
          `ALTER TYPE "enum_quiz_questions_type" ADD VALUE 'true_false';`,
          { transaction }
        );
      } catch (error) {
        // If the type already has 'true_false' or for other databases, continue
        console.log('Enum already contains true_false or not using PostgreSQL');
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // Note: PostgreSQL doesn't support removing enum values easily
    // This is a limitation of PostgreSQL
  }
};
