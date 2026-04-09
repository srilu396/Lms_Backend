const { AttendanceSession, StudentAttendance, Batch, User, Enrollment } = require('../models');

class AttendanceService {
    async createSession(data) {
        const { batch_id, session_date, session_name, start_time, end_time } = data;
        
        // Verify batch exists
        const batch = await Batch.findByPk(batch_id);
        if (!batch) {
            throw new Error('Batch not found');
        }

        const session = await AttendanceSession.create({
            batch_id,
            session_date,
            session_name,
            start_time,
            end_time
        });

        return session;
    }

    async logAttendance(sessionId, attendanceData) {
        const session = await AttendanceSession.findByPk(sessionId);
        if (!session) {
            throw new Error('Attendance session not found');
        }

        const markedRecords = [];
        
        // Upsert attendance records
        for (const record of attendanceData) {
            const { student_id, enrollment_id, status } = record;
            
            // Automatically find enrollment if not fully provided, or validate if provided
            let whereClause = {
                student_id,
                batch_id: session.batch_id
            };
            if (record.enrollment_id) whereClause.id = record.enrollment_id;

            const enrollment = await Enrollment.findOne({ where: whereClause });

            if (!enrollment) {
                // Instead of throwing an error and crashing the whole request, we skip and continue
                continue;
            }

            const trueEnrollmentId = enrollment.id;

            // check if exists
            let studentAttendance = await StudentAttendance.findOne({
                where: {
                    session_id: sessionId,
                    student_id
                }
            });

            if (studentAttendance) {
                studentAttendance.status = status;
                studentAttendance.marked_at = new Date();
                await studentAttendance.save();
            } else {
                studentAttendance = await StudentAttendance.create({
                    session_id: sessionId,
                    student_id,
                    enrollment_id: trueEnrollmentId,
                    status
                });
            }

            markedRecords.push(studentAttendance);
        }

        return markedRecords;
    }

    async getBatchAttendanceReport(batchId) {
        const batch = await Batch.findByPk(batchId);
        if (!batch) {
            throw new Error('Batch not found');
        }

        const sessions = await AttendanceSession.findAll({
            where: { batch_id: batchId },
            include: [
                {
                    model: StudentAttendance,
                    include: [
                        {
                            model: User,
                            attributes: ['id', 'full_name', 'email', 'student_code']
                        }
                    ]
                }
            ],
            order: [['session_date', 'DESC'], ['start_time', 'DESC']]
        });

        // Summary calculations
        let totalSessions = sessions.length;
        let summary = {
            total_sessions: totalSessions,
            sessions: sessions
        };

        return summary;
    }
}

module.exports = new AttendanceService();
