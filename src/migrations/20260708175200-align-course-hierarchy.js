'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // 1. Drop constraints and columns from assignments
      await queryInterface.sequelize.query(
        `ALTER TABLE assignments DROP CONSTRAINT IF EXISTS assignments_topic_id_fkey;`,
        { transaction }
      );
      await queryInterface.removeColumn('assignments', 'topic_id', { transaction });

      // 2. Drop constraints and columns from quizzes
      await queryInterface.sequelize.query(
        `ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS fk_quiz_topic;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE quizzes DROP CONSTRAINT IF EXISTS quizzes_topic_id_fkey;`,
        { transaction }
      );
      await queryInterface.removeColumn('quizzes', 'topic_id', { transaction });

      // 3. Add pdf_url columns to modules, lessons, and topics
      await queryInterface.addColumn('modules', 'pdf_url', {
        type: Sequelize.STRING(500),
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('lessons', 'pdf_url', {
        type: Sequelize.STRING(500),
        allowNull: true
      }, { transaction });

      await queryInterface.addColumn('topics', 'pdf_url', {
        type: Sequelize.STRING(500),
        allowNull: true
      }, { transaction });

      // 4. Create partial unique index on assignments(course_id)
      // to enforce only ONE Course Assignment (where module_id and lesson_id are null)
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS uq_course_assignment ON assignments (course_id) WHERE module_id IS NULL AND lesson_id IS NULL;`,
        { transaction }
      );
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // 1. Drop unique index
      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS uq_course_assignment;`,
        { transaction }
      );

      // 2. Drop pdf_url columns
      await queryInterface.removeColumn('modules', 'pdf_url', { transaction });
      await queryInterface.removeColumn('lessons', 'pdf_url', { transaction });
      await queryInterface.removeColumn('topics', 'pdf_url', { transaction });

      // 3. Add topic_id back to assignments
      await queryInterface.addColumn('assignments', 'topic_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'topics',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction });

      // 4. Add topic_id back to quizzes
      await queryInterface.addColumn('quizzes', 'topic_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'topics',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      }, { transaction });
    });
  }
};
