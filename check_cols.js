const { sequelize } = require('./src/models');

async function checkCols() {
  try {
    const topics = await sequelize.getQueryInterface().describeTable('topics');
    console.log("Topics columns:", Object.keys(topics));
    
    const lessons = await sequelize.getQueryInterface().describeTable('lessons');
    console.log("Lessons columns:", Object.keys(lessons));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
checkCols();
