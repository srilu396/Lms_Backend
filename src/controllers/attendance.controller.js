const attendanceService = require('../services/attendance.service');

const createSession = async (req, res, next) => {
    try {
        const session = await attendanceService.createSession(req.body);
        res.status(201).json({
            success: true,
            data: session,
            message: 'Attendance session created successfully'
        });
    } catch (error) {
        if (error.message === 'Batch not found') {
            return res.status(404).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const markAttendance = async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const { attendance } = req.body;

        if (!attendance || !Array.isArray(attendance)) {
            return res.status(400).json({ success: false, message: 'Invalid attendance data format' });
        }

        const markedRecords = await attendanceService.logAttendance(sessionId, attendance);
        res.status(200).json({
            success: true,
            data: markedRecords,
            message: 'Attendance marked successfully'
        });
    } catch (error) {
        if (error.message === 'Attendance session not found' || error.message.startsWith('Enrollment invalid')) {
            return res.status(400).json({ success: false, message: error.message });
        }
        next(error);
    }
};

const getBatchReport = async (req, res, next) => {
    try {
        const { batchId } = req.params;
        const report = await attendanceService.getBatchAttendanceReport(batchId);
        res.status(200).json({
            success: true,
            data: report,
            message: 'Batch attendance report fetched successfully'
        });
    } catch (error) {
        if (error.message === 'Batch not found') {
            return res.status(404).json({ success: false, message: error.message });
        }
        next(error);
    }
};

module.exports = {
    createSession,
    markAttendance,
    getBatchReport
};
