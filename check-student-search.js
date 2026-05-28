const studentService = require('./src/services/student.service');
const { connectDB, sequelize } = require('./src/db/connect');

async function test() {
  await connectDB();
  try {
    const students = await studentService.getStudents({ search: "a" });
    console.log("Success! Data length:", students.data.length);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
  process.exit();
}
test();
