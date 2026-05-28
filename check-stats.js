const studentService = require('./src/services/student.service');
const { connectDB, sequelize } = require('./src/db/connect');

async function test() {
  await connectDB();
  try {
    const stats = await studentService.getStudentStats();
    console.log("Success! Data:", stats);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
  process.exit();
}
test();
