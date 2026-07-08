'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add new ENUM values to PostgreSQL enum type outside of a transaction block
    const newEnums = [
      'BATCH_CREATED',
      'BATCH_ALLOCATED_TUTOR',
      'BATCH_ALLOCATED_STUDENT',
      'TOP_PERFORMER',
      'LEAST_PERFORMER',
      'ATTENDANCE_WARNING',
      'AT_RISK_INCREASED',
      'ASSIGNMENT_SUBMITTED',
      'ASSIGNMENT_ADDED'
    ];

    for (const val of newEnums) {
      try {
        await queryInterface.sequelize.query(
          `ALTER TYPE "enum_notifications_type" ADD VALUE IF NOT EXISTS '${val}';`
        );
      } catch (err) {
        // Safe to ignore errors if it was already added or cannot be executed in this block
        console.warn(`Warning while adding ${val} to enum_notifications_type:`, err.message);
      }
    }

    // 2. Create table institution_at_risk_snapshot
    const tableExists = await queryInterface.sequelize.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'institution_at_risk_snapshot');`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    if (!tableExists[0].exists) {
      await queryInterface.createTable('institution_at_risk_snapshot', {
        institution_id: {
          type: Sequelize.BIGINT,
          primaryKey: true,
          allowNull: false,
          references: {
            model: 'institutions',
            key: 'id'
          },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE'
        },
        count: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.dropTable('institution_at_risk_snapshot');
    } catch (err) {
      console.error('Error dropping institution_at_risk_snapshot table:', err.message);
    }
  }
};
