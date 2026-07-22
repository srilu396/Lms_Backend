const { sequelize } = require('./src/models');

async function run() {
  try {
    await sequelize.query('ALTER TABLE batches ADD COLUMN domain_id INTEGER REFERENCES domains(id) ON UPDATE CASCADE ON DELETE SET NULL;');
    console.log("Successfully added domain_id");
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('Column already exists, ignoring.');
    } else {
      console.error(err);
    }
  } finally {
    process.exit();
  }
}

run();
