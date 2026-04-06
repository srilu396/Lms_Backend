const express = require('express');
const router = express.Router();
const courseController = require('../controllers/course.controller');
const moduleController = require('../controllers/courseModule.controller');
const enrollmentController = require('../controllers/enrollment.controller');
const validate = require('../middlewares/validate');
const { 
    createCourseSchema, updateCourseSchema, createModuleSchema, enrollStudentSchema
} = require('../utils/validations/course.validation');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

router.use(authMiddleware);

const adminAndTutor = roleMiddleware('admin', 'tutor');
const adminOnly = roleMiddleware('admin');

router.post('/', adminAndTutor, validate(createCourseSchema), courseController.createCourse);
router.get('/', courseController.getCourses); // All authenticated roles (authMiddleware handles it) 
router.get('/stats', adminAndTutor, courseController.getCourseStats);
router.get('/:id', courseController.getCourseById); // All authenticated roles
router.put('/:id', adminAndTutor, validate(updateCourseSchema), courseController.updateCourse);
router.delete('/:id', adminOnly, courseController.deleteCourse);

// Modules in course
router.post('/:courseId/modules', adminAndTutor, validate(createModuleSchema), moduleController.addModule);

// Enrollment (students shouldn't enroll themselves directly here, maybe admin does?)
router.post('/enroll', adminOnly, validate(enrollStudentSchema), enrollmentController.enrollStudent);

// Curriculum
router.get('/:id/curriculum', courseController.getCurriculum);

module.exports = router;
