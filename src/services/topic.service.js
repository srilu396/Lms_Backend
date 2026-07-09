const { Topic, Lesson } = require('../models');

class TopicService {
    async createTopic(lessonId, data) {
        const topicData = { ...data };
        const lesson = await Lesson.findByPk(lessonId);
        if (!lesson) {
            const error = new Error('Lesson not found');
            error.statusCode = 404;
            throw error;
        }
        
        // Remove created_at if passed to let Sequelize handle it
        delete topicData.created_at;

        const topic = await Topic.create({ ...topicData, lesson_id: lessonId });
        return topic;
    }

    async updateTopic(topicId, data) {
        const topicData = { ...data };
        const topic = await Topic.findByPk(topicId);
        if (!topic) {
            const error = new Error('Topic not found');
            error.statusCode = 404;
            throw error;
        }

        delete topicData.created_at;
        await topic.update(topicData);
        return topic;
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
}

module.exports = new TopicService();
