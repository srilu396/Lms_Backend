const studentService = require('./src/services/student.service');
const { connectDB, sequelize } = require('./src/db/connect');

async function test() {
  await connectDB();
  try {
    const student = await studentService.getStudentById(9);
    console.log("Success! Data:", student);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
  process.exit();
}
test();
