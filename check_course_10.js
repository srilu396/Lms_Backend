const { sequelize, Course } = require('./src/models');

async function run() {
  try {
    const course = await Course.findByPk(10);
    console.log(course ? `Found course 10. Status: ${course.status}` : 'Course 10 not found');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
run();
