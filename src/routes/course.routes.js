const express = require('express');
const router = express.Router();
const courseController = require('../controllers/course.controller');
const moduleController = require('../controllers/courseModule.controller');
const enrollmentController = require('../controllers/enrollment.controller');
const validate = require('../middlewares/validate');
const { 
    createCourseSchema, updateCourseSchema, createModuleSchema, enrollStudentSchema
} = require('../utils/validations/course.validation');

router.post('/', validate(createCourseSchema), courseController.createCourse);
router.get('/', courseController.getCourses);
router.get('/stats', courseController.getCourseStats);
router.get('/:id', courseController.getCourseById);
router.put('/:id', validate(updateCourseSchema), courseController.updateCourse);
router.delete('/:id', courseController.deleteCourse);

// Modules in course
router.post('/:courseId/modules', validate(createModuleSchema), moduleController.addModule);

// Enrollment
router.post('/enroll', validate(enrollStudentSchema), enrollmentController.enrollStudent);

// Curriculum
router.get('/:id/curriculum', courseController.getCurriculum);

module.exports = router;
