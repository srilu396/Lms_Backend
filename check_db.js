const { sequelize } = require('./src/db/connect');
async function check() {
  try {
    const [meta] = await sequelize.query("SELECT * FROM \"SequelizeMeta\";");
    console.log("Migrations in DB:", meta);
    const [cols] = await sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name='users';");
    console.log("Columns in users:", cols.map(c => c.column_name));
  } catch(e) {
    console.error(e);
  } finally {
    sequelize.close();
  }
}
check();
