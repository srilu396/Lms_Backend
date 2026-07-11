const express = require('express');
const router = express.Router();
const lessonController = require('../controllers/lesson.controller');
const topicController = require('../controllers/topic.controller');
const validate = require('../middlewares/validate');
const { createLessonSchema, updateLessonSchema, createTopicSchema } = require('../utils/validations/course.validation');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const adminAndTutor = roleMiddleware('admin', 'tutor');

router.use(authMiddleware);

router.put('/:lessonId', adminAndTutor, validate(updateLessonSchema), lessonController.updateLesson);
router.delete('/:lessonId', adminAndTutor, lessonController.deleteLesson);
router.post('/:lessonId/complete', lessonController.completeLesson);

router.post('/:lessonId/topics', adminAndTutor, validate(createTopicSchema), topicController.addTopic);

module.exports = router;
