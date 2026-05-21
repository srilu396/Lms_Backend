const { sequelize } = require('./src/db/connect');
const { AssignmentSubmission, Enrollment, BatchAssignment, Assignment } = require('./src/models');
const { Op } = require('sequelize');

async function testStats() {
    await sequelize.authenticate();
    
    // Find a user who has a submission
    const submission = await AssignmentSubmission.findOne();
    if (!submission) {
        console.log("No submissions found in DB");
        process.exit(0);
    }
    
    const userId = submission.student_id;
    console.log("Found submission for user:", userId);
    
    const studentPortalService = require('./src/services/student-portal.service');
    const stats = await studentPortalService.getAssignmentStats(userId);
    console.log("Stats returned:", stats);
    
    process.exit(0);
}
testStats();
