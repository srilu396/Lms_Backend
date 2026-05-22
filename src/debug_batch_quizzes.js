require('dotenv').config();
const models = require('./models/index');
const { Op } = require('sequelize');

async function debugBatchQuizzes(batchId) {
    try {

        const submissions = await models.QuizSubmission.findAll({
            include: [
                { model: models.Enrollment, where: { batch_id: batchId }, required: true },
                { model: models.User, attributes: ['id', 'full_name'] },
                { model: models.Quiz, attributes: ['name'] }
            ]
        });

        if (submissions.length > 0) {
        }

    } catch (error) {
    } finally {
        await models.sequelize.close();
    }
}

debugBatchQuizzes(30); // Sept-Morning-Batch
