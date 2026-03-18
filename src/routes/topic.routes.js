const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topic.controller');
const lessonController = require('../controllers/lesson.controller');
const validate = require('../middlewares/validate');
const { createTopicSchema, updateTopicSchema, createLessonSchema } = require('../utils/validations/course.validation');

router.put('/:topicId', validate(updateTopicSchema), topicController.updateTopic);
router.delete('/:topicId', topicController.deleteTopic);
router.post('/', validate(createTopicSchema), topicController.addTopic);

router.post('/:topicId/lessons', validate(createLessonSchema), lessonController.addLesson);

module.exports = router;
