const express = require('express');
const router = express.Router();
const tutorPortalController = require('../controllers/tutor-portal.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { Tutor } = require('../models');

// All tutor portal routes require authentication + tutor role
router.use(authMiddleware);
router.use(roleMiddleware('tutor'));

// Middleware to resolve the internal tutor_id from the users table email
const attachTutorId = async (req, res, next) => {
    try {
        const tutor = await Tutor.findOne({ where: { email: req.user.email } });
        if (!tutor) {
            return res.status(403).json({ success: false, message: 'Tutor profile not found for this user.' });
        }
        req.tutorId = tutor.id;
        next();
    } catch (error) {
        next(error);
    }
};

router.use(attachTutorId);

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

// GET /tutor-portal/quiz/:quizId/submission/:studentId/download
// Download quiz submission review as PDF
router.get('/quiz/:quizId/submission/:studentId/download', tutorPortalController.downloadQuizReviewPDF);

// GET /tutor-portal/batch/:batchId/quiz/:quizId/submission/:studentId
// Batch-specific student quiz submission review
router.get('/batch/:batchId/quiz/:quizId/submission/:studentId', tutorPortalController.getQuizReview);

// GET /tutor-portal/batch/:batchId/quiz/:quizId/submission/:studentId/download
// Batch-specific student quiz submission download
router.get('/batch/:batchId/quiz/:quizId/submission/:studentId/download', tutorPortalController.downloadQuizReviewPDF);

// --------------------------------------------------
// ASSIGNMENT MODULE
// --------------------------------------------------

// GET /tutor-portal/assignments/stats
// Global assignment statistics for the tutor's dashboard
router.get('/assignments/stats', tutorPortalController.getAssignmentStats);

// GET /tutor-portal/assignments
// Batch-wise assignment overview (table data)
router.get('/assignments', tutorPortalController.getAssignmentsOverview);

// GET /tutor-portal/batch/:batchId/assignment-stats
// Assignment statistics for a specific batch
router.get('/batch/:batchId/assignment-stats', tutorPortalController.getBatchAssignmentStats);

// GET /tutor-portal/batch/:batchId/assignments
// Student assignment list in a specific batch (table data)
router.get('/batch/:batchId/assignments', tutorPortalController.getBatchStudentAssignments);

// GET /tutor-portal/assignment/:assignmentId/submission/:studentId
// Full review data for a specific student assignment submission (resolved via active enrollment)
router.get('/assignment/:assignmentId/submission/:studentId', tutorPortalController.getAssignmentReview);

// GET /tutor-portal/batch/:batchId/assignment/:assignmentId/submission/:studentId
// Batch-specific student assignment submission review
router.get('/batch/:batchId/assignment/:assignmentId/submission/:studentId', tutorPortalController.getAssignmentReview);

// POST /tutor-portal/assignment/:assignmentId/submission/:studentId/evaluate
// Grade or draft evaluation for a specific student assignment submission
router.post('/assignment/:assignmentId/submission/:studentId/evaluate', tutorPortalController.evaluateAssignmentSubmission);

// POST /tutor-portal/batch/:batchId/assignment/:assignmentId/submission/:studentId/evaluate
// Batch-specific grade or draft evaluation for a student assignment submission
router.post('/batch/:batchId/assignment/:assignmentId/submission/:studentId/evaluate', tutorPortalController.evaluateAssignmentSubmission);

module.exports = router;

