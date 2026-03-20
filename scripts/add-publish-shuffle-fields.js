require('dotenv').config();
const { sequelize } = require('../src/models');

const alterSchema = async () => {
    try {
        // Add is_published column
        await sequelize.query(`
            ALTER TABLE quizzes 
            ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false,
            ADD COLUMN IF NOT EXISTS shuffle_questions BOOLEAN DEFAULT false;
        `);

        console.log('✅ Database schema updated successfully!');
        console.log('✅ Added is_published column (default: false)');
        console.log('✅ Added shuffle_questions column (default: false)');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating database:', error);
        process.exit(1);
    }
};

alterSchema();
