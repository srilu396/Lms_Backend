const express = require('express');
const router = express.Router();
const lessonController = require('../controllers/lesson.controller');
const validate = require('../middlewares/validate');
const { createLessonSchema, updateLessonSchema } = require('../utils/validations/course.validation');

router.put('/:lessonId', validate(updateLessonSchema), lessonController.updateLesson);
router.delete('/:lessonId', lessonController.deleteLesson);
router.post('/', validate(createLessonSchema), lessonController.addLesson);
router.post('/:lessonId/complete', lessonController.completeLesson);

module.exports = router;
