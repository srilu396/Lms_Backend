const express = require('express');
const router = express.Router();
const studentPortalController = require('../controllers/student-portal.controller');
const noteController = require('../controllers/note.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
// All student portal routes require authentication + student, admin, tutor roles
router.use(authMiddleware);
router.use(roleMiddleware('student', 'admin', 'tutor'));


// GET /student-portal/stats
// Overview cards: Active Batches, Quizzes Attempted, Assignments Submitted
router.get('/stats', studentPortalController.getStats);

// GET /student-portal/my-batches?page=1&limit=10&search=&status=
// Paginated list of batches the student is enrolled in
router.get('/my-batches', studentPortalController.getMyBatches);

// GET /student-portal/batch/:batchId/course
// Full nested course structure for a batch (Modules → Topics → Lessons + Quizzes)
router.get('/batch/:batchId/course', studentPortalController.getBatchCourse);

// GET /student-portal/batch/:batchId/attendance?page=1&limit=10
// Student's own attendance records for a specific batch
router.get('/batch/:batchId/attendance', studentPortalController.getMyAttendance);

// GET /student-portal/my-quizzes?page=1&limit=10
// All quiz submissions made by the student
router.get('/my-quizzes', studentPortalController.getMyQuizzes);

// GET /student-portal/my-assignments?page=1&limit=10
// All assignment submissions made by the student
router.get('/my-assignments', studentPortalController.getMyAssignments);

// GET /student-portal/quiz/:quizId/review
// Detailed review of a specific quiz attempt
router.get('/quiz/:quizId/review', studentPortalController.getQuizReview);

// GET /student-portal/enrolled-courses?search=&page=1&limit=10
// All courses enrolled by the student with progress and tutor details
router.get('/enrolled-courses', studentPortalController.getEnrolledCourses);

// GET /student-portal/course/:courseId/home
// Overview of course details and learning statistics
router.get('/course/:courseId/home', studentPortalController.getCourseHome);

// GET /student-portal/course/:courseId/:contentType/activity
// List items (modules, lessons, topics, quizzes, assignments) based on activity and lock status
router.get('/course/:courseId/:contentType(modules|lessons|topics|quizzes|assignments)/activity', studentPortalController.getCompletedItems);

// GET /student-portal/course/:courseId/view
// Detailed course structure with completion status for the learning page
router.get('/course/:courseId/view', studentPortalController.getCourseView);

// POST /student-portal/lesson/:lessonId/complete
// Marks a lesson as completed and updates progress
router.post('/lesson/:lessonId/complete', studentPortalController.completeLesson);

// POST /student-portal/lesson/:lessonId/read (Legacy support)
// Marks a lesson as read (typically for text-based lessons)
router.post('/lesson/:lessonId/read', studentPortalController.markAsRead);

// PATCH /student-portal/modules/:moduleId/read
router.patch('/modules/:moduleId/read', studentPortalController.markModuleAsRead);

// PATCH /student-portal/lessons/:lessonId/read
router.patch('/lessons/:lessonId/read', studentPortalController.markLessonAsRead);

// PATCH /student-portal/topics/:topicId/read
router.patch('/topics/:topicId/read', studentPortalController.markTopicAsRead);

// GET /student-portal/course/:courseId/sidebar
// Lightweight structure for the learning page sidebar
router.get('/course/:courseId/sidebar', studentPortalController.getCourseSidebar);

// GET /student-portal/course/:courseId/module/:moduleId
// Specific module details (Lazy loading)
router.get('/course/:courseId/module/:moduleId', studentPortalController.getCourseModule);

// GET /student-portal/course/:courseId/lesson/:lessonId
// Specific lesson details (Lazy loading)
router.get('/course/:courseId/lesson/:lessonId', studentPortalController.getCourseLesson);

// GET /student-portal/course/:courseId/topic/:topicId
// Specific topic details (Lazy loading)
router.get('/course/:courseId/topic/:topicId', studentPortalController.getCourseTopic);

// ---------------------------------------------------------
// NEW NOTES API
// ---------------------------------------------------------
// Course Notes
router.get('/course/:courseId/notes', noteController.getCourseNotes);
router.post('/course/:courseId/notes', noteController.createCourseNote);
router.put('/course/:courseId/notes', noteController.updateCourseNote);

// Module Notes
router.get('/course/:courseId/module/:moduleId/notes', noteController.getModuleNotes);
router.post('/course/:courseId/module/:moduleId/notes', noteController.createModuleNote);
router.put('/course/:courseId/module/:moduleId/notes', noteController.updateModuleNote);

// Lesson Notes
router.get('/course/:courseId/lesson/:lessonId/notes', noteController.getLessonNotes);
router.post('/course/:courseId/lesson/:lessonId/notes', noteController.createLessonNote);
router.put('/course/:courseId/lesson/:lessonId/notes', noteController.updateLessonNote);

// Topic Notes
router.get('/course/:courseId/topic/:topicId/notes', noteController.getTopicNotes);
router.post('/course/:courseId/topic/:topicId/notes', noteController.createTopicNote);
router.put('/course/:courseId/topic/:topicId/notes', noteController.updateTopicNote);
// ---------------------------------------------------------

// Course Completion
router.post('/course/:courseId/complete', studentPortalController.completeCourse);

// Student Quiz APIs
router.get('/course/:courseId/quiz/:quizId', studentPortalController.getCourseQuiz);
router.post('/course/:courseId/quiz/:quizId/start', studentPortalController.startCourseQuiz);
router.post('/course/:courseId/quiz/:quizId/submit', studentPortalController.submitQuiz);
router.get('/course/quiz/result', studentPortalController.getQuizResult);
router.get('/course/:courseId/quiz/:quizId/review', studentPortalController.getCourseQuizReview);

// Attendance APIs
router.get('/attendance/stats', studentPortalController.getAttendanceStats);
router.get('/attendance/table', studentPortalController.getAttendanceTable);
router.get('/attendance-report', studentPortalController.getAttendanceReport);

// Assignment APIs
router.get('/assignment/stats', studentPortalController.getAssignmentStats);
router.get('/assignment/table', studentPortalController.getAssignmentTable);
router.get('/course/:courseId/assignment/:assignmentId', studentPortalController.getCourseAssignment);
router.post('/course/:courseId/assignment/:assignmentId/submit', studentPortalController.submitCourseAssignment);
router.get('/course/:courseId/assignment/:assignmentId/result', studentPortalController.getCourseAssignmentResult);

module.exports = router;
