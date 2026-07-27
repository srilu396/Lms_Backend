const { sequelize } = require('./src/db/connect');

async function fixQuizQuestionsTable() {
  try {
    console.log("Checking and adding explanation to quiz_questions...");
    await sequelize.query(`ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS explanation TEXT;`);
    
    console.log("Local database 'quiz_questions' table fixed successfully!");
  } catch (err) {
    console.error("Error fixing database:", err);
  } finally {
    await sequelize.close();
  }
}

fixQuizQuestionsTable();
