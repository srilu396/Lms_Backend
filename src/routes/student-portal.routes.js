const express = require('express');
const router = express.Router();
const studentPortalController = require('../controllers/student-portal.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = 'uploads/profiles';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});


// All student portal routes require authentication + student role
router.use(authMiddleware);
router.use(roleMiddleware('student'));

// GET /student-portal/profile
// Returns the logged-in student's profile
router.get('/profile', studentPortalController.getProfile);

// PUT /student-portal/profile
// Updates the logged-in student's profile (including image)
router.put('/profile', upload.single('profile_image'), studentPortalController.updateProfile);


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

// GET /student-portal/course/:courseId/view
// Detailed course structure with completion status for the learning page
router.get('/course/:courseId/view', studentPortalController.getCourseView);

// POST /student-portal/lesson/:lessonId/complete
// Marks a lesson as completed and updates progress
router.post('/lesson/:lessonId/complete', studentPortalController.completeLesson);

// POST /student-portal/lesson/:lessonId/read
// Marks a lesson as read (typically for text-based lessons)
router.post('/lesson/:lessonId/read', studentPortalController.markAsRead);

// GET /student-portal/course/:courseId/sidebar
// Lightweight structure for the learning page sidebar
router.get('/course/:courseId/sidebar', studentPortalController.getCourseSidebar);

// Notes API
router.get('/notes/lesson/:lessonId', studentPortalController.getNote);
router.put('/notes/lesson/:lessonId', studentPortalController.saveNote);

// Course Completion
router.post('/course/:courseId/complete', studentPortalController.completeCourse);

// Student Quiz APIs
router.get('/course/:courseId/quiz/:quizId', studentPortalController.getCourseQuiz);
router.post('/course/:courseId/quiz/:quizId/submit', studentPortalController.submitQuiz);
router.get('/course/quiz/result', studentPortalController.getQuizResult);
router.get('/course/:courseId/quiz/:quizId/review', studentPortalController.getCourseQuizReview);

// Attendance APIs
router.get('/attendance/stats', studentPortalController.getAttendanceStats);
router.get('/attendance/table', studentPortalController.getAttendanceTable);

// Assignment APIs
router.get('/assignment/stats', studentPortalController.getAssignmentStats);
router.get('/assignment/table', studentPortalController.getAssignmentTable);
router.get('/course/:courseId/assignment/:assignmentId', studentPortalController.getCourseAssignment);
router.post('/course/:courseId/assignment/:assignmentId/submit', studentPortalController.submitCourseAssignment);
router.get('/course/:courseId/assignment/:assignmentId/result', studentPortalController.getCourseAssignmentResult);

module.exports = router;
