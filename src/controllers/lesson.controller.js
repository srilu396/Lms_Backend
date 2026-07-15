const lessonService = require('../services/lesson.service');

class LessonController {
    async addLesson(req, res) {
        try {
            const moduleId = req.params.moduleId || req.body.module_id;
            if (!moduleId) {
                return res.status(400).json({ success: false, message: 'module_id is required' });
            }
            const lesson = await lessonService.createLesson(moduleId, req.body);
            res.status(201).json({
                success: true,
                message: 'Lesson added successfully',
                data: lesson
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error adding lesson'
            });
        }
    }

    async updateLesson(req, res) {
        try {
            const lesson = await lessonService.updateLesson(req.params.lessonId, req.body);
            res.status(200).json({
                success: true,
                message: 'Lesson updated successfully',
                data: lesson
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error updating lesson'
            });
        }
    }

    async getLesson(req, res) {
        try {
            const lesson = await lessonService.getLesson(req.params.lessonId);
            res.status(200).json({
                success: true,
                message: 'Lesson retrieved successfully',
                data: lesson
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error retrieving lesson'
            });
        }
    }

    async deleteLesson(req, res) {
        try {
            await lessonService.deleteLesson(req.params.lessonId);
            res.status(200).json({
                success: true,
                message: 'Operation successful',
                data: null
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error deleting lesson'
            });
        }
    }

    async completeLesson(req, res) {
        try {
            const { student_id, enrollment_id } = req.body;
            if (!student_id || !enrollment_id) {
                return res.status(400).json({ success: false, message: 'student_id and enrollment_id are required' });
            }
            const result = await lessonService.completeLesson(req.params.lessonId, student_id, enrollment_id);
            res.status(200).json({
                success: true,
                message: result.message,
                data: result
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error completing lesson'
            });
        }
    }
}

module.exports = new LessonController();
