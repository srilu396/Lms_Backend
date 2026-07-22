'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // On fresh databases, sync-all-models.js creates the quizzes table from the
    // current Quiz model, which no longer has a topic_id column (new hierarchy).
    // This check prevents a hard failure when the column does not exist.
    const tableDesc = await queryInterface.describeTable('quizzes');
    if (!tableDesc.topic_id) {
      // Column does not exist — already on new hierarchy schema, skip safely.
      return;
    }

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
    // Same guard: only revert if the column actually exists.
    const tableDesc = await queryInterface.describeTable('quizzes');
    if (!tableDesc.topic_id) {
      return;
    }

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
