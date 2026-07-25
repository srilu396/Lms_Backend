const { sequelize } = require('./src/db/connect');

async function fixCoursesTable() {
  try {
    console.log("Checking and adding tags...");
    await sequelize.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS tags VARCHAR(255)[] NOT NULL DEFAULT '{}';`);
    
    console.log("Checking and adding final_assessment_id...");
    await sequelize.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS final_assessment_id INT;`);
    
    console.log("Checking and adding final_assessment_type enum...");
    await sequelize.query(`DO $$ BEGIN
      CREATE TYPE enum_courses_final_assessment_type AS ENUM ('assignment', 'quiz');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;`);
    
    console.log("Checking and adding final_assessment_type column...");
    await sequelize.query(`ALTER TABLE courses ADD COLUMN IF NOT EXISTS final_assessment_type enum_courses_final_assessment_type;`);
    
    console.log("Local database 'courses' table fixed successfully!");
  } catch (err) {
    console.error("Error fixing database:", err);
  } finally {
    await sequelize.close();
  }
}

fixCoursesTable();
