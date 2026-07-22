'use strict';

/**
 * Normalization Migration — Establish Module → Lesson → Topic Hierarchy
 *
 * This migration is fully idempotent and safe to run on:
 *   1. A fresh database (where sync-all-models already created tables from
 *      current models — new hierarchy, correct column names).
 *   2. An existing database (that may still have old hierarchy columns or
 *      title instead of name columns).
 *
 * All steps use IF EXISTS / IF NOT EXISTS checks so re-running never errors.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // ─────────────────────────────────────────────────────────────────────────
    // Helper: describe a table and return its column map
    // ─────────────────────────────────────────────────────────────────────────
    const describe = (table) => queryInterface.describeTable(table);

    // ─────────────────────────────────────────────────────────────────────────
    // Step 1 — Rename title → name on core tables (if old schema)
    //   The original create-course-api-tables used 'title'; models use 'name'.
    // ─────────────────────────────────────────────────────────────────────────
    for (const table of ['courses', 'modules', 'lessons', 'topics']) {
      const cols = await describe(table);
      if (cols.title && !cols.name) {
        await queryInterface.renameColumn(table, 'title', 'name');
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 2 — Add lessons.module_id (new hierarchy FK)
    // ─────────────────────────────────────────────────────────────────────────
    const lessonsCols = await describe('lessons');
    if (!lessonsCols.module_id) {
      await queryInterface.addColumn('lessons', 'module_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'modules', key: 'id' },
        onDelete: 'CASCADE'
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 3 — Populate lessons.module_id from old hierarchy data
    //   Old hierarchy: lessons.topic_id → topics.module_id → modules
    //   We back-fill module_id before dropping topic_id.
    // ─────────────────────────────────────────────────────────────────────────
    const topicsColsStep3 = await describe('topics');
    const lessonsColsStep3 = await describe('lessons');
    if (topicsColsStep3.module_id && lessonsColsStep3.topic_id) {
      await queryInterface.sequelize.query(`
        UPDATE lessons l
        SET module_id = t.module_id
        FROM topics t
        WHERE l.topic_id = t.id
          AND l.module_id IS NULL
          AND t.module_id IS NOT NULL;
      `);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 4 — Add topics.lesson_id (new hierarchy FK)
    // ─────────────────────────────────────────────────────────────────────────
    const topicsCols = await describe('topics');
    if (!topicsCols.lesson_id) {
      await queryInterface.addColumn('topics', 'lesson_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'lessons', key: 'id' },
        onDelete: 'CASCADE'
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 5 — Populate topics.lesson_id from old hierarchy data
    //   Old hierarchy: lessons.topic_id → topics (lesson points to its topic)
    //   We reverse this to: topics.lesson_id = their parent lesson
    // ─────────────────────────────────────────────────────────────────────────
    const lessonsColsStep5 = await describe('lessons');
    if (lessonsColsStep5.topic_id) {
      await queryInterface.sequelize.query(`
        UPDATE topics t
        SET lesson_id = l.id
        FROM lessons l
        WHERE l.topic_id = t.id
          AND t.lesson_id IS NULL;
      `);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 6 — Drop old hierarchy columns (after data migration above)
    //   Only drop if the columns still exist.
    // ─────────────────────────────────────────────────────────────────────────
    const lessonsColsStep6 = await describe('lessons');
    if (lessonsColsStep6.topic_id) {
      // Drop FK constraint first, then the column
      await queryInterface.sequelize.query(`
        ALTER TABLE lessons
        DROP CONSTRAINT IF EXISTS lessons_topic_id_fkey;
      `);
      await queryInterface.removeColumn('lessons', 'topic_id');
    }

    const topicsColsStep6 = await describe('topics');
    if (topicsColsStep6.module_id) {
      await queryInterface.sequelize.query(`
        ALTER TABLE topics
        DROP CONSTRAINT IF EXISTS topics_module_id_fkey;
      `);
      await queryInterface.removeColumn('topics', 'module_id');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 7 — Add missing content columns to modules, lessons, topics
    //   Each column is only added if it doesn't already exist.
    // ─────────────────────────────────────────────────────────────────────────
    const moduleContentCols = {
      description: { type: Sequelize.TEXT, allowNull: true },
      image_url:   { type: Sequelize.STRING, allowNull: true },
      video_url:   { type: Sequelize.STRING, allowNull: true },
      pdf_url:     { type: Sequelize.STRING, allowNull: true },
      url:         { type: Sequelize.STRING, allowNull: true },
      content_text:{ type: Sequelize.TEXT, allowNull: true },
      text:        { type: Sequelize.TEXT, allowNull: true },
      is_locked:   { type: Sequelize.BOOLEAN, defaultValue: false, allowNull: false }
    };
    const moduleCols = await describe('modules');
    for (const [col, def] of Object.entries(moduleContentCols)) {
      if (!moduleCols[col]) {
        await queryInterface.addColumn('modules', col, def);
      }
    }

    const lessonContentCols = {
      image_url:   { type: Sequelize.STRING, allowNull: true },
      pdf_url:     { type: Sequelize.STRING, allowNull: true },
      url:         { type: Sequelize.STRING, allowNull: true },
      content_text:{ type: Sequelize.TEXT, allowNull: true },
      text:        { type: Sequelize.TEXT, allowNull: true }
    };
    const lessonCols = await describe('lessons');
    for (const [col, def] of Object.entries(lessonContentCols)) {
      if (!lessonCols[col]) {
        await queryInterface.addColumn('lessons', col, def);
      }
    }

    const topicContentCols = {
      description: { type: Sequelize.TEXT, allowNull: true },
      image_url:   { type: Sequelize.STRING, allowNull: true },
      video_url:   { type: Sequelize.STRING, allowNull: true },
      pdf_url:     { type: Sequelize.STRING, allowNull: true },
      url:         { type: Sequelize.STRING, allowNull: true },
      content_text:{ type: Sequelize.TEXT, allowNull: true },
      text:        { type: Sequelize.TEXT, allowNull: true }
    };
    const topicCols = await describe('topics');
    for (const [col, def] of Object.entries(topicContentCols)) {
      if (!topicCols[col]) {
        await queryInterface.addColumn('topics', col, def);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 8 — Add missing course-level columns
    // ─────────────────────────────────────────────────────────────────────────
    const courseMissingCols = {
      status:         { type: Sequelize.STRING, defaultValue: 'draft', allowNull: true },
      institution_id: { type: Sequelize.INTEGER, allowNull: true },
      domain_id:      { type: Sequelize.INTEGER, allowNull: true },
      deleted_at:     { type: Sequelize.DATE, allowNull: true },
      unique_code:    { type: Sequelize.STRING, allowNull: true }
    };
    const courseCols = await describe('courses');
    for (const [col, def] of Object.entries(courseMissingCols)) {
      if (!courseCols[col]) {
        await queryInterface.addColumn('courses', col, def);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 9 — Add missing progress table columns (if those tables exist)
    // ─────────────────────────────────────────────────────────────────────────
    try {
      const spCols = await describe('student_progress');
      if (!spCols.enrollment_id) {
        await queryInterface.addColumn('student_progress', 'enrollment_id', {
          type: Sequelize.INTEGER,
          allowNull: true
        });
      }
    } catch (e) {
      // Table doesn't exist yet — skip
    }

    try {
      const lpCols = await describe('lesson_progress');
      if (!lpCols.video_watch_pct) {
        await queryInterface.addColumn('lesson_progress', 'video_watch_pct', {
          type: Sequelize.FLOAT,
          allowNull: true
        });
      }
      if (!lpCols.last_accessed) {
        await queryInterface.addColumn('lesson_progress', 'last_accessed', {
          type: Sequelize.DATE,
          allowNull: true
        });
      }
    } catch (e) {
      // Table doesn't exist yet — skip
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Step 10 — Verify FK integrity: create FKs if they don't exist
    // ─────────────────────────────────────────────────────────────────────────

    // lessons.module_id → modules(id)
    const [fkLessonsRows] = await queryInterface.sequelize.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'lessons'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'fk_lessons_module_id';
    `);
    if (!fkLessonsRows.length) {
      const lessonsFinal = await describe('lessons');
      if (lessonsFinal.module_id) {
        await queryInterface.sequelize.query(`
          ALTER TABLE lessons
          ADD CONSTRAINT fk_lessons_module_id
          FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;
        `);
      }
    }

    // topics.lesson_id → lessons(id)
    const [fkTopicsRows] = await queryInterface.sequelize.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'topics'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'fk_topics_lesson_id';
    `);
    if (!fkTopicsRows.length) {
      const topicsFinal = await describe('topics');
      if (topicsFinal.lesson_id) {
        await queryInterface.sequelize.query(`
          ALTER TABLE topics
          ADD CONSTRAINT fk_topics_lesson_id
          FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;
        `);
      }
    }
  },

  async down(queryInterface, Sequelize) {
    // Down migration intentionally does not restore old hierarchy columns
    // because restoring a broken hierarchy is not meaningful and could
    // cause irreversible data loss.
    // To roll back, restore from a database backup taken before this migration.
    console.warn(
      '[WARNING] Down migration for normalize-course-hierarchy is a no-op. ' +
      'Restore from a database backup if rollback is needed.'
    );
  }
};
