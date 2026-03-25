'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('users', 'refresh_token', {
            type: Sequelize.STRING,
            allowNull: true
        });

        try {
            // Attempt to add 'user' to the existing ENUM type in postgres
            // Ignore error if it already exists or if using a different dialect
            await queryInterface.sequelize.query('ALTER TYPE "enum_users_role" ADD VALUE \'user\';');
        } catch (error) {
            console.log("Adding enum value failed, it might already exist or DB is not Postgres:", error.message);
        }
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('users', 'refresh_token');
    }
};
