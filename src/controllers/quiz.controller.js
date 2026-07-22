const quizService = require('../services/quiz.service');

class QuizController {
    async getQuizStats(req, res) {
        try {
            const stats = await quizService.getQuizStats();
            res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Server error retrieving quiz statistics'
            });
        }
    }

    async getQuizzes(req, res) {
        try {
            const result = await quizService.getQuizzes(req.query);
            
            let message = 'Quizzes retrieved successfully';
            if (req.query.search && result.data.length === 0) {
                message = 'No quizzes found matching your search criteria.';
            }

            res.status(200).json({
                success: true,
                message,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Server error retrieving quizzes'
            });
        }
    }

    async getQuizLookup(req, res) {
        try {
            const result = await quizService.getQuizLookup(req.query);
            res.status(200).json({
                success: true,
                message: 'Quizzes lookup retrieved successfully',
                data: result.data
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Server error retrieving quizzes lookup'
            });
        }
    }

    async getQuizById(req, res) {
        try {
            const quiz = await quizService.getQuizById(req.params.id);
            if (!quiz) {
                return res.status(404).json({
                    success: false,
                    message: 'Quiz not found'
                });
            }

            res.status(200).json({
                success: true,
                data: quiz
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error retrieving quiz'
            });
        }
    }

    async createQuiz(req, res) {
        try {
            const quiz = await quizService.createQuiz(req.body);
            res.status(201).json({
                success: true,
                message: 'Quiz created successfully',
                data: quiz
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error creating quiz'
            });
        }
    }

    async updateQuiz(req, res) {
        try {
            const quiz = await quizService.updateQuiz(req.params.id, req.body);
            res.status(200).json({
                success: true,
                message: 'Quiz updated successfully',
                data: quiz
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error updating quiz'
            });
        }
    }

    async deleteQuiz(req, res) {
        try {
            await quizService.deleteQuiz(req.params.id);
            res.status(200).json({
                success: true,
                message: 'Quiz deleted successfully'
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error deleting quiz'
            });
        }
    }

    async unlinkQuiz(req, res) {
        try {
            const { id } = req.params;
            const { level } = req.body;
            
            const updateField = {};
            if (level === 'course') updateField.course_id = null;
            else if (level === 'module') updateField.module_id = null;
            else if (level === 'lesson') updateField.lesson_id = null;
            else {
                return res.status(400).json({ success: false, message: 'Invalid level for unlinking' });
            }

            await quizService.unlinkQuiz(id, updateField);

            res.status(200).json({
                success: true,
                message: 'Quiz unlinked successfully'
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error unlinking quiz'
            });
        }
    }
}

module.exports = new QuizController();
