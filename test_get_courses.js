const courseService = require('./src/services/course.service');

async function run() {
  try {
    const res = await courseService.getCourses();
    console.log(res);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
