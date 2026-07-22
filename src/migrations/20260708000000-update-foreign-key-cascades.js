'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `ALTER TABLE assignments DROP CONSTRAINT IF EXISTS fk_assignment_module;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE assignments ADD CONSTRAINT fk_assignment_module FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE SET NULL;`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS fk_quiz_topic;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE quizzes ADD CONSTRAINT fk_quiz_topic FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE SET NULL;`,
        { transaction }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `ALTER TABLE assignments DROP CONSTRAINT IF EXISTS fk_assignment_module;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE assignments ADD CONSTRAINT fk_assignment_module FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;`,
        { transaction }
      );

      await queryInterface.sequelize.query(
        `ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS fk_quiz_topic;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE quizzes ADD CONSTRAINT fk_quiz_topic FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE;`,
        { transaction }
      );
    });
  }
};
