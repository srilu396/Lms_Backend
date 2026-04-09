const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendance.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

// Protect all attendance routes
router.use(authMiddleware);

// Create an attendance session
router.post(
    '/session',
    roleMiddleware('admin', 'institution_representative', 'tutor'),
    attendanceController.createSession
);

// Log student presence/absence
router.post(
    '/session/:sessionId/mark',
    roleMiddleware('admin', 'institution_representative', 'tutor'),
    attendanceController.markAttendance
);

// Get attendance reports for a batch
router.get(
    '/batch/:batchId',
    roleMiddleware('admin', 'institution_representative', 'tutor'),
    attendanceController.getBatchReport
);

module.exports = router;
