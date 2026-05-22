const express = require('express');
const router = express.Router();
const attendanceCalendarController = require('../../controllers/institutionRep/attendance-calendar.controller');
const institutionRepAuth = require('../../middlewares/institutionRepAuth');

/**
 * @route   GET /api/v1/institution-rep/batches/:batchId/students/:studentId/attendance-calendar
 * @desc    Get monthly attendance calendar and statistics for a student
 * @access  Private (Institution Representative)
 */
router.get('/:batchId/students/:studentId/attendance-calendar', institutionRepAuth, attendanceCalendarController.getAttendanceCalendar);

module.exports = router;
