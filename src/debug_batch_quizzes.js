require('dotenv').config();
const models = require('./models/index');
const { Op } = require('sequelize');

async function debugBatchQuizzes(batchId) {
    try {
        console.log(`--- DEBUGGING BATCH QUIZZES FOR BATCH ${batchId} ---\n`);

        const submissions = await models.QuizSubmission.findAll({
            include: [
                { model: models.Enrollment, where: { batch_id: batchId }, required: true },
                { model: models.User, attributes: ['id', 'full_name'] },
                { model: models.Quiz, attributes: ['name'] }
            ]
        });

        console.log(`Found ${submissions.length} submissions.`);
        if (submissions.length > 0) {
            console.log(JSON.stringify(submissions[0], null, 2));
        }

    } catch (error) {
        console.error("❌ Error during debug:");
        console.error(error);
    } finally {
        await models.sequelize.close();
    }
}

debugBatchQuizzes(30); // Sept-Morning-Batch
