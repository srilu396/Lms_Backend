'use strict';

const models = require('../models');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Sync entirely based on the created index and models
    await models.sequelize.sync({ force: true });
  },

  async down(queryInterface, Sequelize) {
    // Discards all tables
    await models.sequelize.drop();
  }
};
