const { sequelize } = require('./src/models');

async function addProfileImage() {
    try {
        console.log("Adding profile_image column to students table...");
        await sequelize.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_image VARCHAR(255);');
        console.log("Column added successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Error adding column:", error);
        process.exit(1);
    }
}

addProfileImage();
