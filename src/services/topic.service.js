const { Topic, Module, Assignment, Quiz, Lesson } = require('../models');

class TopicService {
    async createTopic(moduleId, data) {
        const { ...topicData } = data;
        const mod = await Module.findByPk(moduleId);
        if (!mod) {
            const error = new Error('Module not found');
            error.statusCode = 404;
            throw error;
        }
        const topic = await Topic.create({ ...topicData, module_id: moduleId });



        return await topic.reload({
            include: [
                { model: Lesson, as: 'lessons', include: [{ model: Assignment, as: 'assignments' }, { model: Quiz, as: 'quizzes' }] }
            ]
        });
    }

    async updateTopic(topicId, data) {
        const { ...topicData } = data;
        const topic = await Topic.findByPk(topicId, {
            include: [{ model: Module }]
        });
        if (!topic) {
            const error = new Error('Topic not found');
            error.statusCode = 404;
            throw error;
        }
        await topic.update(topicData);



        return await topic.reload({
            include: [
                { model: Lesson, as: 'lessons', include: [{ model: Assignment, as: 'assignments' }, { model: Quiz, as: 'quizzes' }] }
            ]
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
}

module.exports = new TopicService();
