const courseService = require('./src/services/course.service');
const { Course } = require('./src/models');

async function run() {
  try {
    const course = await Course.findOne({ where: { status: 'draft' }});
    if (!course) {
        console.log("No courses found.");
        process.exit();
    }
    const res = await courseService.getCourseById(course.id);
    console.log(`Successfully fetched course ${course.id}:`, res.name);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

run();
