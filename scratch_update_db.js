const { sequelize } = require('./src/db/connect');

async function updateDb() {
  try {
    console.log("Adding enum value...");
    await sequelize.query(`ALTER TYPE enum_quiz_submissions_status ADD VALUE IF NOT EXISTS 'in_progress';`);
    
    console.log("DB updated successfully!");
  } catch (err) {
    console.error(err);
  } finally {
    await sequelize.close();
  }
}

updateDb();
