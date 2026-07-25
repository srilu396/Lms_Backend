'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('quiz_submissions');

    if (!tableDesc.started_at) {
      await queryInterface.addColumn('quiz_submissions', 'started_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    if (!tableDesc.expires_at) {
      await queryInterface.addColumn('quiz_submissions', 'expires_at', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    // Change submitted_at to be nullable and drop its default
    await queryInterface.changeColumn('quiz_submissions', 'submitted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      defaultValue: null
    });

    // Add 'in_progress' to the enum for status
    // Note: Postgres ENUM values cannot be easily removed inside down(), so we just add it in up().
    try {
      await queryInterface.sequelize.query(`ALTER TYPE enum_quiz_submissions_status ADD VALUE IF NOT EXISTS 'in_progress';`);
    } catch (error) {
      // If the enum is not named exactly enum_quiz_submissions_status or it's not a Postgres ENUM, this might fail. 
      // We catch the error to prevent migration crash if it's already there or using a string check constraint.
      console.warn('Warning: Could not alter ENUM type directly. Might be a different dialect or constraint type.', error.message);
    }
  },

  async down(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('quiz_submissions');

    if (tableDesc.expires_at) {
      await queryInterface.removeColumn('quiz_submissions', 'expires_at');
    }

    if (tableDesc.started_at) {
      await queryInterface.removeColumn('quiz_submissions', 'started_at');
    }

    // Revert submitted_at to NOT NULL and CURRENT_TIMESTAMP
    await queryInterface.changeColumn('quiz_submissions', 'submitted_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    });
    
    // Postgres does not support removing values from an ENUM easily, so we leave 'in_progress' in the ENUM type.
  }
};
