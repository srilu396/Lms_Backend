const { sequelize } = require('./src/models');

async function createNotesTable() {
    try {
        console.log("Creating notes table...");
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS notes (
                id SERIAL PRIMARY KEY,
                student_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
                lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
                content TEXT NOT NULL,
                timestamp VARCHAR(255),
                type VARCHAR(50) DEFAULT 'general',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Table created successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Error creating table:", error);
        process.exit(1);
    }
}

createNotesTable();
