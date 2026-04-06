const ProgressService = require('../services/progress.service');

class ProgressController {
    /**
     * Update progress for a specific lesson
     * PUT /api/v1/progress/enrollments/:enrollment_id/lessons/:lesson_id
     */
    async updateLessonProgress(req, res, next) {
        try {
            const { enrollment_id, lesson_id } = req.params;
            const studentId = req.user.id;
            const data = req.body; 

            const result = await ProgressService.updateLessonProgress(
                studentId, 
                parseInt(enrollment_id, 10), 
                parseInt(lesson_id, 10), 
                data
            );
            
            res.status(200).json({
                success: true,
                message: 'Lesson progress updated successfully',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get course progress summary
     * GET /api/v1/progress/enrollments/:enrollment_id/summary
     */
    async getCourseProgressSummary(req, res, next) {
        try {
            const { enrollment_id } = req.params;
            const studentId = req.user.id;
            
            const summary = await ProgressService.getCourseProgressSummary(
                studentId, 
                parseInt(enrollment_id, 10)
            );

            res.status(200).json({
                success: true,
                data: summary
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ProgressController();
