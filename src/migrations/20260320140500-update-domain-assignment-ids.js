'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop the old column
    await queryInterface.removeColumn('domains', 'assignment_id');
    
    // Add the new array column
    await queryInterface.addColumn('domains', 'assignment_ids', {
      type: Sequelize.ARRAY(Sequelize.INTEGER),
      defaultValue: [],
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('domains', 'assignment_ids');
    await queryInterface.addColumn('domains', 'assignment_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'assignments',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  }
};
