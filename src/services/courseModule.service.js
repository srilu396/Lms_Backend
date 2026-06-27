const { Module, Course, Assignment, Quiz, Topic, Lesson } = require('../models');

class ModuleService {
    async createModule(courseId, data) {
        const { assignments, quizzes, ...moduleData } = data;
        
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
        if (assignments && Array.isArray(assignments)) {
            await Assignment.update(
                { module_id: mod.id, course_id: courseId },
                { where: { id: assignments } }
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
                    model: Topic,
                    as: 'topics',
                    include: [
                        { 
                            model: Lesson, 
                            as: 'lessons', 
                            include: [
                                { model: Assignment, as: 'assignments' },
                                { model: Quiz, as: 'quizzes' }
                            ]
                        }
                    ]
                }
            ]
        });
    }

    async updateModule(moduleId, data) {
        const { assignments, quizzes, ...moduleData } = data;
        const mod = await Module.findByPk(moduleId);
        if (!mod) {
            const error = new Error('Module not found');
            error.statusCode = 404;
            throw error;
        }

        delete moduleData.created_at;
        await mod.update(moduleData);

        // Link existing assignments
        if (assignments && Array.isArray(assignments)) {
            await Assignment.update(
                { module_id: mod.id },
                { where: { id: assignments } }
            );
        }

        // Link existing quizzes
        if (quizzes && Array.isArray(quizzes)) {
            await Quiz.update(
                { module_id: mod.id },
                { where: { id: quizzes } }
            );
        }

        return await mod.reload({
            include: [
                { model: Assignment, as: 'assignments' },
                { model: Quiz, as: 'quizzes' },
                {
                    model: Topic,
                    as: 'topics',
                    include: [
                        { 
                            model: Lesson, 
                            as: 'lessons', 
                            include: [
                                { model: Assignment, as: 'assignments' },
                                { model: Quiz, as: 'quizzes' }
                            ]
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
