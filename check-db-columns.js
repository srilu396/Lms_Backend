const { connectDB, sequelize } = require('./src/db/connect');

async function test() {
  await connectDB();
  try {
    const [results] = await sequelize.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name IN ('students', 'courses', 'users')
    `);
    console.log(results);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
  process.exit();
}
test();
