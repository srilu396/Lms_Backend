const { Student } = require('./src/models');
const { connectDB, sequelize } = require('./src/db/connect');

async function test() {
  await connectDB();
  try {
    const students = await Student.findAll();
    console.log(students);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
  process.exit();
}
test();
