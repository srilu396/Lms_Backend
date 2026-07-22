'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // courses
    await queryInterface.changeColumn('courses', 'thumbnail_url', {
      type: Sequelize.TEXT,
      allowNull: true
    });

    // modules
    await queryInterface.changeColumn('modules', 'image_url', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.changeColumn('modules', 'video_url', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.changeColumn('modules', 'url', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.changeColumn('modules', 'pdf_url', { type: Sequelize.TEXT, allowNull: true });

    // lessons
    await queryInterface.changeColumn('lessons', 'image_url', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.changeColumn('lessons', 'video_url', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.changeColumn('lessons', 'url', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.changeColumn('lessons', 'pdf_url', { type: Sequelize.TEXT, allowNull: true });

    // topics
    await queryInterface.changeColumn('topics', 'image_url', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.changeColumn('topics', 'video_url', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.changeColumn('topics', 'url', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.changeColumn('topics', 'pdf_url', { type: Sequelize.TEXT, allowNull: true });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert columns back to character varying (some were 255, pdf_url was 500)
    await queryInterface.changeColumn('courses', 'thumbnail_url', { type: Sequelize.STRING(255), allowNull: true });

    await queryInterface.changeColumn('modules', 'image_url', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.changeColumn('modules', 'video_url', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.changeColumn('modules', 'url', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.changeColumn('modules', 'pdf_url', { type: Sequelize.STRING(500), allowNull: true });

    await queryInterface.changeColumn('lessons', 'image_url', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.changeColumn('lessons', 'video_url', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.changeColumn('lessons', 'url', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.changeColumn('lessons', 'pdf_url', { type: Sequelize.STRING(500), allowNull: true });

    await queryInterface.changeColumn('topics', 'image_url', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.changeColumn('topics', 'video_url', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.changeColumn('topics', 'url', { type: Sequelize.STRING(255), allowNull: true });
    await queryInterface.changeColumn('topics', 'pdf_url', { type: Sequelize.STRING(500), allowNull: true });
  }
};
