const { sequelize } = require('./src/db/connect');

async function addColumn() {
    try {
        console.log('Altering table...');
        await sequelize.query('ALTER TABLE assignment_submissions ADD COLUMN IF NOT EXISTS submission_data JSON;');
        console.log('Column added successfully.');
    } catch (e) {
        console.error('Error adding column:', e);
    }
    process.exit(0);
}
addColumn();
