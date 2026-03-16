require('dotenv').config();
const { sequelize, Quiz, QuizQuestion } = require('../src/models');

const syncDB = async () => {
    try {
        // Alter Quiz table to add new fields
        await sequelize.query(`
            ALTER TABLE quizzes 
            ADD COLUMN IF NOT EXISTS total_marks INTEGER,
            ADD COLUMN IF NOT EXISTS domain JSONB,
            ADD COLUMN IF NOT EXISTS tags JSONB,
            ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'draft';
        `);

        // Create status enum type if it doesn't exist
        try {
            await sequelize.query(`
                CREATE TYPE enum_quizzes_status AS ENUM ('published', 'draft', 'scheduled');
            `);
        } catch (e) {
            console.log('Enum type might already exist');
        }

        // Update the column type to use enum
        try {
            await sequelize.query(`
                ALTER TABLE quizzes 
                ALTER COLUMN status TYPE enum_quizzes_status USING status::text::enum_quizzes_status;
            `);
        } catch (e) {
            console.log('Status column type update skipped');
        }

        console.log('✅ Database schema updated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error syncing database:', error);
        process.exit(1);
    }
};

syncDB();
