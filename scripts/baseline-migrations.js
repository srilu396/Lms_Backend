const fs = require('fs');
const path = require('path');
const { sequelize } = require('../src/db/connect');

async function baselineMigrations() {
    try {
        console.log('Starting migration baselining...');
        
        // 1. Ensure connection and SequelizeMeta table exists
        await sequelize.authenticate();
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS "SequelizeMeta" (
                "name" VARCHAR(255) NOT NULL PRIMARY KEY
            );
        `);
        console.log('SequelizeMeta table ready.');

        // 2. Read all migration files
        const migrationsDir = path.join(__dirname, '../src/migrations');
        const files = fs.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.js'))
            .sort();
            
        console.log(`Found ${files.length} migration files.`);

        // 3. Upsert them into the database
        for (const file of files) {
            // Check if it already exists to avoid duplicate key errors
            const [results] = await sequelize.query(`
                SELECT name FROM "SequelizeMeta" WHERE name = '${file}';
            `);
            
            if (results.length === 0) {
                await sequelize.query(`
                    INSERT INTO "SequelizeMeta" (name) VALUES ('${file}');
                `);
                console.log(`Marked as completed: ${file}`);
            } else {
                console.log(`Already baselined: ${file}`);
            }
        }
        
        console.log('✅ All migrations successfully baselined! Run `npm run migrate` moving forward safely.');
        process.exit(0);
    } catch (error) {
        console.error('Failed to baseline migrations:', error);
        process.exit(1);
    }
}

baselineMigrations();
