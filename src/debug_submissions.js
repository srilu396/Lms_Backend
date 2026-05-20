require('dotenv').config();
const models = require('./models/index');

async function debugSubmissions() {
    try {
        console.log("--- DEBUGGING QUIZ SUBMISSIONS ---\n");

        const submission = await models.QuizSubmission.findOne({
            include: [
                { model: models.Enrollment, attributes: ['id', 'batch_id'] },
                { model: models.User, attributes: ['id', 'full_name'] },
                { model: models.Quiz, attributes: ['id', 'name'] }
            ]
        });

        if (submission) {
            console.log("✅ Found a submission:");
            console.log(JSON.stringify(submission, null, 2));
        } else {
            console.log("❌ No submissions found in database.");
        }

    } catch (error) {
        console.error("❌ Error during debug:");
        console.error(error);
    } finally {
        await models.sequelize.close();
    }
}

debugSubmissions();
