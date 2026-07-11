const db = require('./src/models');

async function addPdfUrls() {
  const queryInterface = db.sequelize.getQueryInterface();
  const transaction = await db.sequelize.transaction();
  
  try {
    console.log("Adding pdf_url to modules...");
    try {
      await queryInterface.addColumn('modules', 'pdf_url', {
        type: db.Sequelize.STRING(500),
        allowNull: true
      }, { transaction });
    } catch(e) { console.log(e.message); } // ignore if exists

    console.log("Adding pdf_url to lessons...");
    try {
      await queryInterface.addColumn('lessons', 'pdf_url', {
        type: db.Sequelize.STRING(500),
        allowNull: true
      }, { transaction });
    } catch(e) { console.log(e.message); }

    console.log("Adding pdf_url to topics...");
    try {
      await queryInterface.addColumn('topics', 'pdf_url', {
        type: db.Sequelize.STRING(500),
        allowNull: true
      }, { transaction });
    } catch(e) { console.log(e.message); }

    await transaction.commit();
    console.log("Successfully added pdf_url columns.");
  } catch (err) {
    await transaction.rollback();
    console.error("Error:", err);
  } finally {
    await db.sequelize.close();
  }
}

addPdfUrls();
