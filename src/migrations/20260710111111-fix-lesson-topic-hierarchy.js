'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const describeTable = async (tableName) => queryInterface.describeTable(tableName, { transaction });

      const lessonsTable = await describeTable('lessons');
      const topicsTable = await describeTable('topics');

      if (!lessonsTable.module_id) {
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
      }

      if (!topicsTable.lesson_id) {
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
      }

      if (lessonsTable.topic_id && topicsTable.module_id) {
        await queryInterface.sequelize.query(
          `UPDATE lessons
           SET module_id = topics.module_id
           FROM topics
           WHERE lessons.topic_id = topics.id
             AND lessons.module_id IS NULL
             AND topics.module_id IS NOT NULL;`,
          { transaction }
        );
      }

      if (lessonsTable.topic_id) {
        await queryInterface.sequelize.query(
          `UPDATE topics
           SET lesson_id = subquery.id
           FROM (
             SELECT id, topic_id
             FROM lessons
           ) AS subquery
           WHERE topics.lesson_id IS NULL
             AND topics.id = subquery.topic_id;`,
          { transaction }
        );
      }

      if (lessonsTable.topic_id) {
        await queryInterface.sequelize.query(
          `ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_topic_id_fkey;`,
          { transaction }
        );
        await queryInterface.removeColumn('lessons', 'topic_id', { transaction });
      }

      if (topicsTable.module_id) {
        await queryInterface.sequelize.query(
          `ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_module_id_fkey;`,
          { transaction }
        );
        await queryInterface.removeColumn('topics', 'module_id', { transaction });
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const lessonsTable = await queryInterface.describeTable('lessons', { transaction });
      const topicsTable = await queryInterface.describeTable('topics', { transaction });

      if (!lessonsTable.topic_id) {
        await queryInterface.addColumn('lessons', 'topic_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'topics',
            key: 'id'
          }
        }, { transaction });
      }

      if (!topicsTable.module_id) {
        await queryInterface.addColumn('topics', 'module_id', {
          type: Sequelize.INTEGER,
          allowNull: true,
          references: {
            model: 'modules',
            key: 'id'
          }
        }, { transaction });
      }

      await queryInterface.sequelize.query(
        `UPDATE topics
         SET module_id = lessons.module_id
         FROM lessons
         WHERE topics.lesson_id = lessons.id;`,
        { transaction }
      );
      await queryInterface.sequelize.query(
        `UPDATE lessons
         SET topic_id = topics.id
         FROM topics
         WHERE lessons.module_id = topics.module_id;`,
        { transaction }
      );

      if (lessonsTable.module_id) {
        await queryInterface.removeColumn('lessons', 'module_id', { transaction });
      }
      if (topicsTable.lesson_id) {
        await queryInterface.removeColumn('topics', 'lesson_id', { transaction });
      }
    });
  }
};
