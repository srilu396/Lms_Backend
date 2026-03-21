const { Lesson, Topic, Module, StudentProgress, LessonProgress, Enrollment, Assignment, Quiz } = require('../models');

class LessonService {
    async createLesson(topicId, data) {
        const { assignments, quizzes, ...lessonData } = data;
        const topic = await Topic.findByPk(topicId, {
            include: [{ model: Module }]
        });
        if (!topic) {
            const error = new Error('Topic not found');
            error.statusCode = 404;
            throw error;
        }
        const lesson = await Lesson.create({ ...lessonData, topic_id: topicId });

        // Link assessments
        if (assignments && Array.isArray(assignments)) {
            await Assignment.update(
                { lesson_id: lesson.id, topic_id: topic.id, module_id: topic.module_id, course_id: topic.Module?.course_id },
                { where: { id: assignments } }
            );
        }
        if (quizzes && Array.isArray(quizzes)) {
            await Quiz.update(
                { lesson_id: lesson.id, topic_id: topic.id, module_id: topic.module_id, course_id: topic.Module?.course_id },
                { where: { id: quizzes } }
            );
        }

        return await lesson.reload({
            include: [
                { model: Assignment, as: 'assignments' },
                { model: Quiz, as: 'quizzes' }
            ]
        });
    }

    async updateLesson(lessonId, data) {
        const { assignments, quizzes, ...lessonData } = data;
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
        await lesson.update(lessonData);

        // Link assessments
        if (assignments && Array.isArray(assignments)) {
            await Assignment.update(
                { lesson_id: lesson.id, topic_id: lesson.topic_id, module_id: lesson.Topic?.module_id, course_id: lesson.Topic?.Module?.course_id },
                { where: { id: assignments } }
            );
        }
        if (quizzes && Array.isArray(quizzes)) {
            await Quiz.update(
                { lesson_id: lesson.id, topic_id: lesson.topic_id, module_id: lesson.Topic?.module_id, course_id: lesson.Topic?.Module?.course_id },
                { where: { id: quizzes } }
            );
        }

        return await lesson.reload({
            include: [
                { model: Assignment, as: 'assignments' },
                { model: Quiz, as: 'quizzes' }
            ]
        });
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
