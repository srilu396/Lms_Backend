'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Alter topic_id column to be nullable
      await queryInterface.changeColumn('quizzes', 'topic_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'topics',
          key: 'id'
        }
      }, { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Revert topic_id to NOT NULL
      await queryInterface.changeColumn('quizzes', 'topic_id', {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'topics',
          key: 'id'
        }
      }, { transaction });
    });
  }
};
