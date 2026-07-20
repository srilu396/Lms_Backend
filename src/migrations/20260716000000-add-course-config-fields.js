'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('courses');

    if (!tableDesc.tags) {
      await queryInterface.addColumn('courses', 'tags', {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
        defaultValue: []
      });
    }

    if (!tableDesc.final_assessment_id) {
      await queryInterface.addColumn('courses', 'final_assessment_id', {
        type: Sequelize.INTEGER,
        allowNull: true
      });
    }

    if (!tableDesc.final_assessment_type) {
      await queryInterface.addColumn('courses', 'final_assessment_type', {
        type: Sequelize.ENUM('assignment', 'quiz'),
        allowNull: true
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('courses');

    if (tableDesc.final_assessment_type) {
      await queryInterface.removeColumn('courses', 'final_assessment_type');
    }

    if (tableDesc.final_assessment_id) {
      await queryInterface.removeColumn('courses', 'final_assessment_id');
    }

    if (tableDesc.tags) {
      await queryInterface.removeColumn('courses', 'tags');
    }
  }
};
