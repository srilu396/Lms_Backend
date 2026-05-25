const { sequelize } = require('../src/db/connect');

async function run() {
  try {
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        reference_id INTEGER,
        reference_type VARCHAR(50),
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id_is_read ON notifications(user_id, is_read)
    `);
    
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at ON notifications(user_id, created_at DESC)
    `);
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS institution_at_risk_snapshot (
        institution_id INTEGER PRIMARY KEY REFERENCES institutions(id) ON UPDATE CASCADE ON DELETE CASCADE,
        at_risk_count INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log("Migration executed successfully.");
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await sequelize.close();
  }
}

run();
