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

module.exports = router;
