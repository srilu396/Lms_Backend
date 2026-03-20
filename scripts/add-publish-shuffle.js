require('dotenv').config();
const { sequelize } = require('../src/models');

const addColumns = async () => {
    try {
        await sequelize.query(`
            ALTER TABLE quizzes 
            ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT false;
        `);
        console.log('✅ Columns added successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

addColumns();
