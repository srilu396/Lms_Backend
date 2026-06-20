'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    try {
      // In Postgres, ALTER TYPE ADD VALUE cannot be executed inside a transaction block easily.
      await queryInterface.sequelize.query("ALTER TYPE enum_assignments_submission_type ADD VALUE IF NOT EXISTS 'text'");
    } catch (e) {
      console.error('Migration failed or enum value already exists:', e);
    }
  },

  async down(queryInterface, Sequelize) {
    // Postgres doesn't easily support dropping an enum value without recreating the type.
    // We'll leave it as a no-op for down.
  }
};
