const { sequelize } = require('./src/db/connect');
const { Assignment, BatchAssignment } = require('./src/models');

async function testStats() {
    await sequelize.authenticate();
    
    const countAllAssignments = await Assignment.count();
    console.log("Total assignments in DB:", countAllAssignments);
    
    const countBatchAssignments = await BatchAssignment.count();
    console.log("Total batch assignments in DB:", countBatchAssignments);
    
    process.exit(0);
}
testStats();
