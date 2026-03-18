const { Module, Course } = require('../models');

class ModuleService {
    async createModule(courseId, data) {
        const course = await Course.findByPk(courseId);
        if (!course) {
            const error = new Error('Course not found');
            error.statusCode = 404;
            throw error;
        }
        return await Module.create({ ...data, course_id: courseId });
    }

    async updateModule(moduleId, data) {
        const mod = await Module.findByPk(moduleId);
        if (!mod) {
            const error = new Error('Module not found');
            error.statusCode = 404;
            throw error;
        }
        return await mod.update(data);
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
