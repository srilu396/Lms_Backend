require('dotenv').config();
const { sequelize } = require('../src/models');

const alterSchema = async () => {
    try {
        // Make topic_id nullable
        await sequelize.query(`
            ALTER TABLE quizzes 
            ALTER COLUMN topic_id DROP NOT NULL;
        `);

        console.log('✅ Database schema updated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error updating database:', error);
        process.exit(1);
    }
};

alterSchema();
