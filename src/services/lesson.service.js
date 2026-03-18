const { Lesson, Topic, Module, StudentProgress, LessonProgress, Enrollment } = require('../models');

class LessonService {
    async createLesson(topicId, data) {
        const topic = await Topic.findByPk(topicId);
        if (!topic) {
            const error = new Error('Topic not found');
            error.statusCode = 404;
            throw error;
        }
        return await Lesson.create({ ...data, topic_id: topicId });
    }

    async updateLesson(lessonId, data) {
        const lesson = await Lesson.findByPk(lessonId);
        if (!lesson) {
            const error = new Error('Lesson not found');
            error.statusCode = 404;
            throw error;
        }
        return await lesson.update(data);
    }

    async deleteLesson(lessonId) {
        const lesson = await Lesson.findByPk(lessonId);
        if (!lesson) {
            const error = new Error('Lesson not found');
            error.statusCode = 404;
            throw error;
        }
        await lesson.destroy();
        return true;
    }

    async completeLesson(lessonId, studentId, enrollmentId) {
        const lesson = await Lesson.findByPk(lessonId, {
            include: [{
                model: Topic,
                include: [{ model: Module }]
            }]
        });

        if (!lesson) {
            const error = new Error('Lesson not found');
            error.statusCode = 404;
            throw error;
        }

        const topic = lesson.Topic;
        const moduleItem = topic.Module;
        const moduleId = moduleItem.id;

        // Note: Project uses LessonProgress for lessons logic.
        let [lessonProgress, created] = await LessonProgress.findOrCreate({
            where: { student_id: studentId, lesson_id: lessonId, enrollment_id: enrollmentId },
            defaults: { is_completed: true, completed_at: new Date() }
        });

        if (!created) {
            lessonProgress.is_completed = true;
            lessonProgress.completed_at = new Date();
            await lessonProgress.save();
        }

        // Check overall module completion
        const allLessonsInModule = await Lesson.findAll({
            include: [{
                model: Topic,
                where: { module_id: moduleId }
            }]
        });

        const allLessonIds = allLessonsInModule.map(l => l.id);

        const completedLessons = await LessonProgress.findAll({
            where: {
                student_id: studentId,
                lesson_id: allLessonIds,
                enrollment_id: enrollmentId,
                is_completed: true
            }
        });

        let moduleCompleted = false;
        if (completedLessons.length >= allLessonIds.length) {
            moduleCompleted = true;
            let [modProgress, modCreated] = await StudentProgress.findOrCreate({
                where: { student_id: studentId, module_id: moduleId, enrollment_id: enrollmentId },
                defaults: { is_completed: true }
            });

            if (!modCreated && !modProgress.is_completed) {
                modProgress.is_completed = true;
                await modProgress.save();
            }
        }

        return {
            message: 'Lesson marked as completed',
            module_completed: moduleCompleted,
            next_module_unlocked: moduleCompleted
        };
    }
}

module.exports = new LessonService();
