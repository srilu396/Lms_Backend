'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.renameColumn('assignments', 'name', 'title', { transaction });
      await queryInterface.changeColumn('assignments', 'module_id', {
        type: Sequelize.INTEGER,
        allowNull: true
      }, { transaction });
      await queryInterface.addColumn('assignments', 'course_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'courses',
          key: 'id'
        }
      }, { transaction });
      await queryInterface.addColumn('assignments', 'description', {
        type: Sequelize.TEXT
      }, { transaction });
      await queryInterface.addColumn('assignments', 'domains', {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      }, { transaction });
      await queryInterface.addColumn('assignments', 'tags', {
        type: Sequelize.ARRAY(Sequelize.STRING),
        defaultValue: []
      }, { transaction });
      await queryInterface.addColumn('assignments', 'submission_type', {
        type: Sequelize.ENUM('file', 'link'),
        allowNull: false,
        defaultValue: 'file'
      }, { transaction });

      // In Postgres, adding ENUM values in a transaction can sometimes be problematic,
      // but if committed inside the transaction or running out of transaction, it might work.
      // Usually "ALTER TYPE ... ADD VALUE" cannot run inside a transaction.
      // We will commit the above first, then run alter type outside.
      await transaction.commit();
      
      try {
        await queryInterface.sequelize.query("ALTER TYPE enum_assignments_status ADD VALUE IF NOT EXISTS 'inactive'");
      } catch (e) {
        console.warn("Could not add 'inactive' to enum_assignments_status. It might already exist.", e.message);
      }
    } catch (err) {
      if (!transaction.finished) await transaction.rollback();
      throw err;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('assignments', 'course_id', { transaction });
      await queryInterface.removeColumn('assignments', 'description', { transaction });
      await queryInterface.removeColumn('assignments', 'domains', { transaction });
      await queryInterface.removeColumn('assignments', 'tags', { transaction });
      await queryInterface.removeColumn('assignments', 'submission_type', { transaction });
      await queryInterface.changeColumn('assignments', 'module_id', {
        type: Sequelize.INTEGER,
        allowNull: false
      }, { transaction });
      await queryInterface.renameColumn('assignments', 'title', 'name', { transaction });
      await transaction.commit();
      
      try {
        await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_assignments_submission_type"');
      } catch (e) {
        console.warn("Could not drop submission_type enum", e.message);
      }
    } catch (err) {
      if (!transaction.finished) await transaction.rollback();
      throw err;
    }
  }
};
