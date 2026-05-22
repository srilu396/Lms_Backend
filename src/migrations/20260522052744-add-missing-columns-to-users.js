'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'phone_number', {
      type: Sequelize.STRING,
      allowNull: true
    }).catch(() => {});
    await queryInterface.addColumn('users', 'avatar_url', {
      type: Sequelize.STRING,
      allowNull: true
    }).catch(() => {});
    await queryInterface.addColumn('users', 'designation', {
      type: Sequelize.STRING,
      allowNull: true
    }).catch(() => {});
    await queryInterface.addColumn('users', 'institution_id', {
      type: Sequelize.BIGINT,
      allowNull: true,
      references: {
        model: 'institutions',
        key: 'id'
      }
    }).catch(() => {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'institution_id').catch(() => {});
    await queryInterface.removeColumn('users', 'designation').catch(() => {});
    await queryInterface.removeColumn('users', 'avatar_url').catch(() => {});
    await queryInterface.removeColumn('users', 'phone_number').catch(() => {});
  }
};
