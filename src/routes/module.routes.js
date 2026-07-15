const express = require('express');
const router = express.Router();
const moduleController = require('../controllers/courseModule.controller');
const lessonController = require('../controllers/lesson.controller');
const validate = require('../middlewares/validate');
const { createModuleSchema, updateModuleSchema, createLessonSchema } = require('../utils/validations/course.validation');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const adminAndTutor = roleMiddleware('admin', 'tutor');

router.use(authMiddleware);

router.get('/:moduleId', adminAndTutor, moduleController.getModule);
router.put('/:moduleId', adminAndTutor, validate(updateModuleSchema), moduleController.updateModule);
router.delete('/:moduleId', adminAndTutor, moduleController.deleteModule);

router.post('/:moduleId/lessons', adminAndTutor, validate(createLessonSchema), lessonController.addLesson);

module.exports = router;
