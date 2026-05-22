const attendanceCalendarService = require('../../services/institutionRep/attendance-calendar.service');

class AttendanceCalendarController {
    /**
     * GET /api/v1/institution-rep/batches/:batchId/students/:studentId/attendance-calendar
     */
    async getAttendanceCalendar(req, res, next) {
        try {
            const { batchId, studentId } = req.params;
            const { month } = req.query; // YYYY-MM
            const institutionId = req.user.institution_id;

            if (!batchId || !studentId) {
                return res.status(400).json({
                    success: false,
                    message: 'batchId and studentId are required'
                });
            }

            const data = await attendanceCalendarService.getAttendanceCalendar(
                parseInt(batchId),
                parseInt(studentId),
                institutionId,
                month
            );

            res.status(200).json({
                success: true,
                data: data
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AttendanceCalendarController();
