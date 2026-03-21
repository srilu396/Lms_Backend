'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add columns to assignments table
    await queryInterface.addColumn('assignments', 'topic_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'topics',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addColumn('assignments', 'lesson_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'lessons',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add columns to quizzes table
    await queryInterface.addColumn('quizzes', 'course_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'courses',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addColumn('quizzes', 'module_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'modules',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
    await queryInterface.addColumn('quizzes', 'lesson_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'lessons',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove from assignments
    await queryInterface.removeColumn('assignments', 'topic_id');
    await queryInterface.removeColumn('assignments', 'lesson_id');

    // Remove from quizzes
    await queryInterface.removeColumn('quizzes', 'course_id');
    await queryInterface.removeColumn('quizzes', 'module_id');
    await queryInterface.removeColumn('quizzes', 'lesson_id');
  }
};
