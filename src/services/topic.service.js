const { Topic, Module } = require('../models');

class TopicService {
    async createTopic(moduleId, data) {
        const mod = await Module.findByPk(moduleId);
        if (!mod) {
            const error = new Error('Module not found');
            error.statusCode = 404;
            throw error;
        }
        return await Topic.create({ ...data, module_id: moduleId });
    }

    async updateTopic(topicId, data) {
        const topic = await Topic.findByPk(topicId);
        if (!topic) {
            const error = new Error('Topic not found');
            error.statusCode = 404;
            throw error;
        }
        return await topic.update(data);
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
