const { sequelize } = require('./src/models');

async function manualMigrate() {
    try {
        console.log("Running manual migration...");
        
        try {
            await sequelize.query('ALTER TABLE batches ADD COLUMN instructor_id BIGINT REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;');
            console.log("Added instructor_id to batches");
        } catch (e) {
            console.log("instructor_id already exists or error:", e.message);
        }

        try {
            await sequelize.query('ALTER TABLE batches ALTER COLUMN course_id DROP NOT NULL;');
            console.log("Made course_id nullable in batches");
        } catch (e) {
            console.log("course_id already nullable or error:", e.message);
        }

        try {
            await sequelize.query('ALTER TABLE batches ALTER COLUMN institution_id DROP NOT NULL;');
            console.log("Made institution_id nullable in batches");
        } catch (e) {
            console.log("institution_id already nullable or error:", e.message);
        }

        try {
            await sequelize.query('ALTER TABLE enrollments ALTER COLUMN student_id TYPE INTEGER;');
            try {
                // Drop foreign key to users if it exists 
                await sequelize.query('ALTER TABLE enrollments DROP CONSTRAINT enrollments_student_id_fkey;');
            } catch (err) {}
            // Add foreign key to students
            await sequelize.query('ALTER TABLE enrollments ADD CONSTRAINT enrollments_student_id_fkey_students FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE ON UPDATE CASCADE;');
            console.log("Updated enrollments student_id to reference students");
        } catch (e) {
            console.log("enrollments student_id error:", e.message);
        }

        console.log("Migration finished!");
        process.exit(0);
    } catch (error) {
        console.error("Error migrating:", error);
        process.exit(1);
    }
}

manualMigrate();
