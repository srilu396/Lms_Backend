const { sequelize } = require('../src/models');
const { Sequelize } = require('sequelize');

async function runMigration() {
    try {
        const queryInterface = sequelize.getQueryInterface();
        await queryInterface.addColumn('batches', 'department', {
            type: Sequelize.STRING,
            allowNull: true
        });
        console.log('Column "department" added to "batches" table successfully.');
        process.exit(0);
    } catch (error) {
        if (error.message.includes('already exists')) {
            console.log('Column "department" already exists.');
            process.exit(0);
        }
        console.error('Error adding column:', error);
        process.exit(1);
    }
}

runMigration();
