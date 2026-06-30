const { sequelize } = require('../src/db/connect');
async function check() {
  try {
    const [cols] = await sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name='quizzes';");
    console.log("Columns in quizzes:", cols.map(c => c.column_name));
  } catch(e) {
    console.error(e);
  } finally {
    sequelize.close();
  }
}
check();
