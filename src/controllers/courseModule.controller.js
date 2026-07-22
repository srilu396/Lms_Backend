const moduleService = require('../services/courseModule.service');

class ModuleController {
    async addModule(req, res) {
        try {
            const courseId = req.params.courseId || req.body.course_id;
            if (!courseId) {
                return res.status(400).json({ success: false, message: 'course_id is required' });
            }
            const mod = await moduleService.createModule(courseId, req.body);
            res.status(201).json({
                success: true,
                message: 'Module added successfully',
                data: mod
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error adding module'
            });
        }
    }

    async updateModule(req, res) {
        try {
            const mod = await moduleService.updateModule(req.params.moduleId, req.body);
            res.status(200).json({
                success: true,
                message: 'Module updated successfully',
                data: mod
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error updating module'
            });
        }
    }

    async getModule(req, res) {
        try {
            const mod = await moduleService.getModule(req.params.moduleId);
            res.status(200).json({
                success: true,
                message: 'Module retrieved successfully',
                data: mod
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error retrieving module'
            });
        }
    }

    async deleteModule(req, res) {
        try {
            await moduleService.deleteModule(req.params.moduleId);
            res.status(200).json({
                success: true,
                message: 'Operation successful',
                data: null
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error deleting module'
            });
        }
    }
}

module.exports = new ModuleController();
