const { Lesson, Topic, Module, StudentProgress, LessonProgress, Enrollment, Assignment, Quiz } = require('../models');

class LessonService {
    async createLesson(moduleId, data) {
        if (data.quiz_ids !== undefined && data.quizzes === undefined) {
            data.quizzes = data.quiz_ids;
        }
        const { assignment_ids, quizzes, ...lessonData } = data;
        const mod = await Module.findByPk(moduleId);
        if (!mod) {
            const error = new Error('Module not found');
            error.statusCode = 404;
            throw error;
        }
        const lesson = await Lesson.create({ ...lessonData, module_id: moduleId });

        if (assignment_ids && Array.isArray(assignment_ids)) {
            await Assignment.update(
                { lesson_id: lesson.id, module_id: moduleId, course_id: mod.course_id },
                { where: { id: assignment_ids } }
            );
        }
        if (quizzes && Array.isArray(quizzes)) {
            await Quiz.update(
                { lesson_id: lesson.id, module_id: moduleId, course_id: mod.course_id },
                { where: { id: quizzes } }
            );
        }

        return await lesson.reload({
            include: [
                { model: Topic, as: 'topics' },
                { model: Assignment, as: 'assignments' },
                { model: Quiz, as: 'quizzes' }
            ]
        });
    }

    async updateLesson(lessonId, data) {
        if (data.quiz_ids !== undefined && data.quizzes === undefined) {
            data.quizzes = data.quiz_ids;
        }
        const { assignment_ids, quizzes, ...lessonData } = data;
        const lesson = await Lesson.findByPk(lessonId, {
            include: [{ model: Module }]
        });
        if (!lesson) {
            const error = new Error('Lesson not found');
            error.statusCode = 404;
            throw error;
        }
        await lesson.update(lessonData);

        if (assignment_ids !== undefined) {
            await Assignment.update({ lesson_id: null, module_id: null, course_id: null }, { where: { lesson_id: lesson.id } });
            if (Array.isArray(assignment_ids) && assignment_ids.length > 0) {
                await Assignment.update(
                    { lesson_id: lesson.id, module_id: lesson.module_id, course_id: lesson.Module ? lesson.Module.course_id : null },
                    { where: { id: assignment_ids } }
                );
            }
        }
        if (quizzes !== undefined) {
            await Quiz.update({ lesson_id: null, module_id: null, course_id: null }, { where: { lesson_id: lesson.id } });
            if (Array.isArray(quizzes) && quizzes.length > 0) {
                await Quiz.update(
                    { lesson_id: lesson.id, module_id: lesson.module_id, course_id: lesson.Module ? lesson.Module.course_id : null },
                    { where: { id: quizzes } }
                );
            }
        }

        return await lesson.reload({
            include: [
                { model: Topic, as: 'topics' },
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
            include: [{ model: Module }]
        });

        if (!lesson) {
            const error = new Error('Lesson not found');
            error.statusCode = 404;
            throw error;
        }

        const moduleItem = lesson.Module;
        if (!moduleItem) {
            const error = new Error('Associated module not found');
            error.statusCode = 404;
            throw error;
        }
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
            where: { module_id: moduleId }
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
