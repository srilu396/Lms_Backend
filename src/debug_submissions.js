require('dotenv').config();
const models = require('./models/index');

async function debugSubmissions() {
    try {

        const submission = await models.QuizSubmission.findOne({
            include: [
                { model: models.Enrollment, attributes: ['id', 'batch_id'] },
                { model: models.User, attributes: ['id', 'full_name'] },
                { model: models.Quiz, attributes: ['id', 'name'] }
            ]
        });

        if (submission) {
        } else {
        }

    } catch (error) {
    } finally {
        await models.sequelize.close();
    }
}

debugSubmissions();
