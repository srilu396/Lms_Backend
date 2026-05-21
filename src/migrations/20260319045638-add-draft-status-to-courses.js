'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // We add 'draft' to the enum_courses_status
    try {
      await queryInterface.sequelize.query("ALTER TYPE \"enum_courses_status\" ADD VALUE IF NOT EXISTS 'draft'");
    } catch (e) {
    }
  },

  down: async (queryInterface, Sequelize) => {
    // Removing enum values is not simple in PG, often omitted for Safety
  }
};
