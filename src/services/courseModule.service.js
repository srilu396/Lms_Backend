const { Module, Course, Assignment, Quiz, Topic, Lesson } = require('../models');

class ModuleService {
    async createModule(courseId, data) {
        if (data.quiz_ids !== undefined && data.quizzes === undefined) {
            data.quizzes = data.quiz_ids;
        }
        const { assignment_ids, quizzes, ...moduleData } = data;
        
        const course = await Course.findByPk(courseId);
        if (!course) {
            const error = new Error('Course not found');
            error.statusCode = 404;
            throw error;
        }

        // Remove created_at if passed to let Sequelize handle it
        delete moduleData.created_at;

        const mod = await Module.create({ ...moduleData, course_id: courseId });

        // Link existing assignments
        if (assignment_ids && Array.isArray(assignment_ids)) {
            await Assignment.update(
                { module_id: mod.id, course_id: courseId },
                { where: { id: assignment_ids } }
            );
        }

        // Link existing quizzes
        if (quizzes && Array.isArray(quizzes)) {
            await Quiz.update(
                { module_id: mod.id, course_id: courseId },
                { where: { id: quizzes } }
            );
        }

        return await mod.reload({
            include: [
                { model: Assignment, as: 'assignments' },
                { model: Quiz, as: 'quizzes' },
                {
                    model: Lesson,
                    as: 'lessons',
                    include: [
                        { model: Assignment, as: 'assignments' },
                        { model: Quiz, as: 'quizzes' },
                        { 
                            model: Topic, 
                            as: 'topics'
                        }
                    ]
                }
            ]
        });
    }

    async updateModule(moduleId, data) {
        if (data.quiz_ids !== undefined && data.quizzes === undefined) {
            data.quizzes = data.quiz_ids;
        }
        const { assignment_ids, quizzes, ...moduleData } = data;
        const mod = await Module.findByPk(moduleId);
        if (!mod) {
            const error = new Error('Module not found');
            error.statusCode = 404;
            throw error;
        }

        delete moduleData.created_at;
        await mod.update(moduleData);

        // Link existing assignments
        if (assignment_ids !== undefined) {
            await Assignment.update({ module_id: null, course_id: null }, { where: { module_id: mod.id } });
            if (Array.isArray(assignment_ids) && assignment_ids.length > 0) {
                await Assignment.update(
                    { module_id: mod.id, course_id: mod.course_id },
                    { where: { id: assignment_ids } }
                );
            }
        }

        // Link existing quizzes
        if (quizzes !== undefined) {
            await Quiz.update({ module_id: null, course_id: null }, { where: { module_id: mod.id } });
            if (Array.isArray(quizzes) && quizzes.length > 0) {
                await Quiz.update(
                    { module_id: mod.id, course_id: mod.course_id },
                    { where: { id: quizzes } }
                );
            }
        }

        return await mod.reload({
            include: [
                { model: Assignment, as: 'assignments' },
                { model: Quiz, as: 'quizzes' },
                {
                    model: Lesson,
                    as: 'lessons',
                    include: [
                        { model: Assignment, as: 'assignments' },
                        { model: Quiz, as: 'quizzes' },
                        { 
                            model: Topic, 
                            as: 'topics'
                        }
                    ]
                }
            ]
        });
    }

    async deleteModule(moduleId) {
        const mod = await Module.findByPk(moduleId);
        if (!mod) {
            const error = new Error('Module not found');
            error.statusCode = 404;
            throw error;
        }
        await mod.destroy();
        return true;
    }
}

module.exports = new ModuleService();
