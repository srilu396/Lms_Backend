const db = require('./src/models');

async function fixHierarchy() {
  const queryInterface = db.sequelize.getQueryInterface();
  const transaction = await db.sequelize.transaction();
  
  try {
    console.log("Adding module_id to lessons...");
    try {
      await queryInterface.addColumn('lessons', 'module_id', {
        type: db.Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'modules', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      }, { transaction });
    } catch(e) { console.log(e.message); } // ignore if exists

    console.log("Adding lesson_id to topics...");
    try {
      await queryInterface.addColumn('topics', 'lesson_id', {
        type: db.Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'lessons', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      }, { transaction });
    } catch(e) { console.log(e.message); } // ignore if exists

    console.log("Migrating data...");
    await queryInterface.sequelize.query(
      `UPDATE lessons SET module_id = topics.module_id FROM topics WHERE lessons.topic_id = topics.id;`,
      { transaction }
    );
    await queryInterface.sequelize.query(
      `UPDATE topics SET lesson_id = (SELECT id FROM lessons WHERE lessons.topic_id = topics.id LIMIT 1);`,
      { transaction }
    );

    console.log("Dropping old columns...");
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE lessons DROP CONSTRAINT IF EXISTS lessons_topic_id_fkey;`,
        { transaction }
      );
      await queryInterface.removeColumn('lessons', 'topic_id', { transaction });
    } catch(e) { console.log(e.message); }

    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE topics DROP CONSTRAINT IF EXISTS topics_module_id_fkey;`,
        { transaction }
      );
      await queryInterface.removeColumn('topics', 'module_id', { transaction });
    } catch(e) { console.log(e.message); }

    await transaction.commit();
    console.log("Successfully fixed LMS hierarchy columns.");
  } catch (err) {
    await transaction.rollback();
    console.error("Error fixing hierarchy:", err);
  } finally {
    await db.sequelize.close();
  }
}

fixHierarchy();
