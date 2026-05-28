const { connectDB, sequelize } = require('./src/db/connect');
const { Student, Course } = require('./src/models');
const studentService = require('./src/services/student.service');

async function test() {
  await connectDB();
  try {
    // Check if any course exists
    let course = await Course.findOne();
    if (!course) {
      console.log("No courses found. Cannot test course relation.");
      process.exit();
    }
    console.log("Using course:", course.id);
    
    // Assign to student 9
    await Student.update({ course_id: course.id }, { where: { id: 9 } });
    
    // Fetch student 9
    const student = await studentService.getStudentById(9);
    console.log("Success! Data:", student);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
  process.exit();
}
test();
