'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add course_ids to domains table
    await queryInterface.addColumn('domains', 'course_ids', {
      type: Sequelize.ARRAY(Sequelize.INTEGER),
      defaultValue: []
    });

    // Add domain_id to courses table
    await queryInterface.addColumn('courses', 'domain_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'domains',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('courses', 'domain_id');
    await queryInterface.removeColumn('domains', 'course_ids');
  }
};
