const express = require('express');
const router = express.Router();
const progressController = require('../controllers/progress.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);

// Only enrolled students can update their progress
router.put('/enrollments/:enrollment_id/lessons/:lesson_id', roleMiddleware('student'), progressController.updateLessonProgress);

// Students and other roles can probably view the summary
router.get('/enrollments/:enrollment_id/summary', progressController.getCourseProgressSummary);

module.exports = router;
