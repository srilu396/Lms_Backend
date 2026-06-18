'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      const studentTable = await queryInterface.describeTable('students');
      if (!studentTable.institution_id) {
        await queryInterface.addColumn('students', 'institution_id', {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: { model: 'institutions', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        }, { transaction });
      }

      const usersTable = await queryInterface.describeTable('users');
      if (!usersTable.institution_id) {
        await queryInterface.addColumn('users', 'institution_id', {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: { model: 'institutions', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL'
        }, { transaction });
      }

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface, Sequelize) => {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.removeColumn('students', 'institution_id', { transaction });
      await queryInterface.removeColumn('users', 'institution_id', { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
