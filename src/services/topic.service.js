const { Topic, Lesson, MediaAttachment, sequelize } = require('../models');
const { handleContentSync, prepareEntityDbData, mediaInclude, serializeWithMedia } = require('../utils/media');

class TopicService {
    async createTopic(lessonId, data) {
        return await sequelize.transaction(async (transaction) => {
            const topicData = { ...data };
            const lesson = await Lesson.findByPk(lessonId, { transaction });
            if (!lesson) {
                const error = new Error('Lesson not found');
                error.statusCode = 404;
                throw error;
            }

            // Remove created_at if passed to let Sequelize handle it
            delete topicData.created_at;

            // Prepare DB data and sync legacy columns from content_blocks
            const dbData = prepareEntityDbData(topicData);

            const topic = await Topic.create({ ...dbData, lesson_id: lessonId }, { transaction });

            // Sync content blocks / media attachments
            await handleContentSync('topic', topic.id, data, transaction);

            return await this._reloadTopic(topic, transaction);
        });
    }

    async updateTopic(topicId, data) {
        return await sequelize.transaction(async (transaction) => {
            const topicData = { ...data };
            const topic = await Topic.findByPk(topicId, { transaction });
            if (!topic) {
                const error = new Error('Topic not found');
                error.statusCode = 404;
                throw error;
            }

            delete topicData.created_at;

            // Prepare DB data and sync legacy columns from content_blocks
            const dbData = prepareEntityDbData(topicData);

            await topic.update(dbData, { transaction });

            // Sync content blocks / media attachments
            await handleContentSync('topic', topic.id, data, transaction);

            return await this._reloadTopic(topic, transaction);
        });
    }

    async deleteTopic(topicId) {
        const topic = await Topic.findByPk(topicId);
        if (!topic) {
            const error = new Error('Topic not found');
            error.statusCode = 404;
            throw error;
        }
        await topic.destroy();
        return true;
    }

    async _reloadTopic(topic, transaction = null) {
        const reloaded = await topic.reload({
            include: [mediaInclude()],
            transaction
        });
        return serializeWithMedia(reloaded.toJSON());
    }
}

module.exports = new TopicService();
