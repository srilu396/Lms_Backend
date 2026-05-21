const { sequelize } = require('./src/db/connect');
const { AssignmentSubmission, Enrollment, BatchAssignment } = require('./src/models');
const { Op } = require('sequelize');

async function testStats() {
    await sequelize.authenticate();
    const userId = 3; // Assuming standard student user id
    const submissions = await AssignmentSubmission.findAll({
        where: {
            student_id: userId
        }
    });
    console.log("Submissions for user 3:", submissions.map(s => s.toJSON()));
    
    const enrollments = await Enrollment.findAll({
        where: { status: 'active' } // Assuming student_id in Enrollment is the Student table ID, let's see.
    });
    console.log("Active Enrollments:", enrollments.map(e => e.toJSON()));
    
    process.exit(0);
}
testStats();
