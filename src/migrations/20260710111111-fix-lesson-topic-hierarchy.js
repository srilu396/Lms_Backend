'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // 1. Add new columns
      await queryInterface.addColumn('lessons', 'module_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'modules',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      }, { transaction });

      await queryInterface.addColumn('topics', 'lesson_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'lessons',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      }, { transaction });

      // 2. Migrate data
      // Populate lessons.module_id from its parent topic
      await queryInterface.sequelize.query(
        `UPDATE lessons SET module_id = topics.module_id FROM topics WHERE lessons.topic_id = topics.id;`,
        { transaction }
      );

      // Populate topics.lesson_id from its first child lesson
      await queryInterface.sequelize.query(
        `UPDATE topics SET lesson_id = (SELECT id FROM lessons WHERE lessons.topic_id = topics.id LIMIT 1);`,
        { transaction }
      );

      // 3. Drop old columns
      await queryInterface.sequelize.query(
        `ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_topic_id_fkey;`,
        { transaction }
      );
      await queryInterface.removeColumn('lessons', 'topic_id', { transaction });

      await queryInterface.sequelize.query(
        `ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_module_id_fkey;`,
        { transaction }
      );
      await queryInterface.removeColumn('topics', 'module_id', { transaction });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // Reverse operations
      await queryInterface.addColumn('lessons', 'topic_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'topics',
          key: 'id'
        }
      }, { transaction });

      await queryInterface.addColumn('topics', 'module_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'modules',
          key: 'id'
        }
      }, { transaction });

      // Best effort restore
      await queryInterface.sequelize.query(
        `UPDATE topics SET module_id = lessons.module_id FROM lessons WHERE topics.lesson_id = lessons.id;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `UPDATE lessons SET topic_id = topics.id FROM topics WHERE lessons.module_id = topics.module_id;`,
        { transaction }
      );

      await queryInterface.removeColumn('lessons', 'module_id', { transaction });
      await queryInterface.removeColumn('topics', 'lesson_id', { transaction });
    });
  }
};
