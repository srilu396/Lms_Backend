const { Topic, Module, Assignment, Quiz, Lesson } = require('../models');

class TopicService {
    async createTopic(lessonId, data) {
        const { assignments, quizzes, ...topicData } = data;
        const lesson = await Lesson.findByPk(lessonId, { include: [{ model: Module }] });
        if (!lesson) {
            const error = new Error('Lesson not found');
            error.statusCode = 404;
            throw error;
        }
        const topic = await Topic.create({ ...topicData, lesson_id: lessonId });

        // Link assessments
        if (assignments && Array.isArray(assignments)) {
            await Assignment.update(
                { topic_id: topic.id, lesson_id: lesson.id, module_id: lesson.module_id, course_id: lesson.Module?.course_id },
                { where: { id: assignments } }
            );
        }
        if (quizzes && Array.isArray(quizzes)) {
            await Quiz.update(
                { topic_id: topic.id, lesson_id: lesson.id, module_id: lesson.module_id, course_id: lesson.Module?.course_id },
                { where: { id: quizzes } }
            );
        }

        return await topic.reload({
            include: [
                { model: Assignment, as: 'assignments' },
                { model: Quiz, as: 'quizzes' }
            ]
        });
    }

    async updateTopic(topicId, data) {
        const { assignments, quizzes, ...topicData } = data;
        const topic = await Topic.findByPk(topicId, {
            include: [{ model: Lesson, include: [{ model: Module }] }]
        });
        if (!topic) {
            const error = new Error('Topic not found');
            error.statusCode = 404;
            throw error;
        }
        await topic.update(topicData);

        // Link assessments
        if (assignments && Array.isArray(assignments)) {
            await Assignment.update(
                { topic_id: topic.id, lesson_id: topic.lesson_id, module_id: topic.Lesson?.module_id, course_id: topic.Lesson?.Module?.course_id },
                { where: { id: assignments } }
            );
        }
        if (quizzes && Array.isArray(quizzes)) {
            await Quiz.update(
                { topic_id: topic.id, lesson_id: topic.lesson_id, module_id: topic.Lesson?.module_id, course_id: topic.Lesson?.Module?.course_id },
                { where: { id: quizzes } }
            );
        }

        return await topic.reload({
            include: [
                { model: Assignment, as: 'assignments' },
                { model: Quiz, as: 'quizzes' }
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
