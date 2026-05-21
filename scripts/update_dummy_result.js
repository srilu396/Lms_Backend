const { sequelize } = require('./src/db/connect');
const models = require('./src/models');
const { AssignmentSubmission } = models;

async function updateSubmission() {
    try {
        console.log('Connecting to database...');
        await sequelize.authenticate();
        
        console.log('Searching for submission with assignment_id = 7...');
        const submission = await AssignmentSubmission.findOne({
            where: { assignment_id: 7 },
            order: [['created_at', 'DESC']]
        });
        
        if (submission) {
            await submission.update({
                grade: 18.5,
                feedback: 'Excellent work! Your research was very thorough and you provided great insights. Keep it up!',
                status: 'graded',
                graded_at: new Date()
            });
            console.log('Successfully updated submission for assignment_id 7 with dummy tutor review data!');
        } else {
            console.log('No submission found for assignment_id 7. Creating a dummy one just in case...');
            // Since we might not know the exact student_id or enrollment_id, we can just print a message.
            console.log('Please ensure you have submitted the assignment first from your student account.');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit(0);
    }
}

updateSubmission();
