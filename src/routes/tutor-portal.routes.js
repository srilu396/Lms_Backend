const express = require('express');
const router = express.Router();
const tutorPortalController = require('../controllers/tutor-portal.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

// All tutor portal routes require authentication + tutor role
router.use(authMiddleware);
router.use(roleMiddleware('tutor'));

// GET /tutor-portal/stats
// Overview cards: Total Batches, Total Students, Pending Evaluations, Today's Sessions
router.get('/stats', tutorPortalController.getStats);

// GET /tutor-portal/dashboard?page=1&limit=10&search=&status=
// Paginated Batch Management table for the tutor
router.get('/dashboard', tutorPortalController.getDashboard);

// GET /tutor-portal/batch/:batchId/course
// Full nested course structure for a specific batch (Modules → Topics → Lessons)
router.get('/batch/:batchId/course', tutorPortalController.getBatchCourse);

// GET /tutor-portal/batch/:batchId/attendance-stats?date=YYYY-MM-DD
// Returns attendance statistics (Total, Present, Absent, Late)
router.get('/batch/:batchId/attendance-stats', tutorPortalController.getAttendanceStats);

// GET /tutor-portal/batch/:batchId/students?date=YYYY-MM-DD&page=1&limit=10&search=&status=
// Student list for a specific batch/date for attendance tagging
router.get('/batch/:batchId/students', tutorPortalController.getBatchStudents);

// POST /tutor-portal/batch/:batchId/attendance
// Mark or update attendance for students in a batch
router.post('/batch/:batchId/attendance', tutorPortalController.markAttendance);

// --------------------------------------------------
// QUIZ MODULE
// --------------------------------------------------

// GET /tutor-portal/quizzes/stats
// Global quiz statistics for the tutor's dashboard
router.get('/quizzes/stats', tutorPortalController.getQuizStats);

// GET /tutor-portal/quizzes
// Batch-wise quiz overview (table data)
router.get('/quizzes', tutorPortalController.getQuizzesOverview);

// GET /tutor-portal/batch/:batchId/quiz-stats
// Quiz statistics for a specific batch
router.get('/batch/:batchId/quiz-stats', tutorPortalController.getBatchQuizStats);

// GET /tutor-portal/batch/:batchId/quizzes
// Student quiz list in a specific batch (table data)
router.get('/batch/:batchId/quizzes', tutorPortalController.getBatchStudentQuizzes);

// GET /tutor-portal/quiz/:quizId/submission/:studentId
// Full review data for a specific student quiz submission
router.get('/quiz/:quizId/submission/:studentId', tutorPortalController.getQuizReview);

module.exports = router;
