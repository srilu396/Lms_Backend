const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quiz.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

// Stats endpoints
router.get('/stats', quizController.getQuizStats);
router.get('/lookup', quizController.getQuizLookup);

// CRUD
router.get('/', quizController.getQuizzes);
router.get('/:id', authMiddleware, roleMiddleware('admin'), quizController.getQuizById);
router.post('/', quizController.createQuiz);
router.post('/:id/unlink', authMiddleware, roleMiddleware('admin', 'tutor'), quizController.unlinkQuiz);
router.put('/:id', quizController.updateQuiz);
router.delete('/:id', quizController.deleteQuiz);

module.exports = router;
