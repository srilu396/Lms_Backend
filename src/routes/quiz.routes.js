const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quiz.controller');

// Stats endpoints
router.get('/stats', quizController.getQuizStats);

// CRUD
router.get('/', quizController.getQuizzes);
router.get('/:id', quizController.getQuizById);
router.post('/', quizController.createQuiz);
router.put('/:id', quizController.updateQuiz);
router.delete('/:id', quizController.deleteQuiz);

module.exports = router;
