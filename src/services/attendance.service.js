const { AttendanceSession, StudentAttendance, Batch, User, Enrollment, Student, QuizSubmission, Quiz } = require('../models');
const { Op } = require('sequelize');
const { createNotification } = require('./notification.service');

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
        const skippedRecords = [];
        
        // Upsert attendance records
        for (const record of attendanceData) {
            const { student_id, status } = record;
            
            // Automatically find enrollment by student_id and batch_id
            let whereClause = {
                student_id,
                batch_id: session.batch_id
            };

            const enrollment = await Enrollment.findOne({ where: whereClause });

            if (!enrollment) {
                // Record the fact that this student was not enrolled in this batch
                skippedRecords.push({
                    student_id,
                    reason: `Student ${student_id} is not enrolled in Batch ${session.batch_id}`
                });
                continue;
            }

            const trueEnrollmentId = enrollment.id;

            try {
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

                // Trigger 6 — Student: Attendance warning
                try {
                    const batch = await Batch.findByPk(session.batch_id);
                    if (batch) {
                        const todayStr = new Date().toISOString().slice(0, 10);
                        const endDateLimit = batch.end_date && batch.end_date < todayStr ? batch.end_date : todayStr;
                        const sessions = await AttendanceSession.findAll({
                            where: {
                                batch_id: batch.id,
                                session_date: {
                                    [Op.between]: [batch.start_date, endDateLimit]
                                }
                            }
                        });
                        
                        const total_working_days = sessions.length;
                        if (total_working_days > 0) {
                            const sessionIds = sessions.map(s => s.id);
                            const studentAttendances = await StudentAttendance.findAll({
                                where: {
                                    student_id: student_id,
                                    session_id: { [Op.in]: sessionIds }
                                }
                            });

                            const days_present = studentAttendances.filter(a => a.status === 'present' || a.status === 'late').length;
                            const new_percent = (days_present / total_working_days) * 100;

                            const prevAttendances = studentAttendances.filter(a => a.session_id !== sessionId);
                            const prevSessions = sessions.filter(s => s.id !== sessionId);
                            const prev_total_working_days = prevSessions.length;
                            const prev_days_present = prevAttendances.filter(a => a.status === 'present' || a.status === 'late').length;
                            const prev_percent = prev_total_working_days > 0 ? (prev_days_present / prev_total_working_days * 100) : 100;

                            if (prev_percent >= 75 && new_percent < 75) {
                                const studentObj = await Student.findByPk(student_id);
                                if (studentObj) {
                                    const studentUser = await User.findOne({ where: { email: studentObj.email } });
                                    if (studentUser) {
                                        await createNotification({
                                            userId: studentUser.id,
                                            role: 'student',
                                            type: 'ATTENDANCE_WARNING',
                                            title: 'Attendance Warning',
                                            message: `Your attendance has dropped to ${new_percent.toFixed(1)}%. The minimum required attendance is 75%. Please attend your sessions regularly.`,
                                            referenceId: batch.id,
                                            referenceType: 'attendance'
                                        });
                                    }
                                }
                            }
                        }
                    }
                } catch (warningErr) {
                    // silent
                }

            } catch (err) {
                skippedRecords.push({
                    student_id,
                    reason: `Database error: failed to save record. ${err.message}`
                });
            }
        }

        // Trigger 7 — Institution Rep: At-risk count increased
        try {
            const batch = await Batch.findByPk(session.batch_id);
            if (batch && batch.institution_id) {
                const institution_id = batch.institution_id;
                
                // Count total at-risk students in this institution
                const batches = await Batch.findAll({ where: { institution_id } });
                const batchIds = batches.map(b => b.id);
                
                let newCount = 0;
                if (batchIds.length > 0) {
                    const enrollments = await Enrollment.findAll({
                        where: { batch_id: { [Op.in]: batchIds }, status: 'active' },
                        include: [
                            {
                                model: QuizSubmission,
                                include: [{ model: Quiz, attributes: ['total_marks'] }]
                            },
                            { model: StudentAttendance, as: 'attendances' }
                        ]
                    });

                    const todayStr = new Date().toISOString().slice(0, 10);
                    const batchSessionsCount = {};
                    for (const b of batches) {
                        const endDateLimit = b.end_date && b.end_date < todayStr ? b.end_date : todayStr;
                        const sCount = await AttendanceSession.count({
                            where: {
                                batch_id: b.id,
                                session_date: {
                                    [Op.between]: [b.start_date, endDateLimit]
                                }
                            }
                        });
                        batchSessionsCount[b.id] = sCount;
                    }

                    for (const e of enrollments) {
                        // Calculate quiz avg
                        let avgQuizScore = 0;
                        if (e.QuizSubmissions && e.QuizSubmissions.length > 0) {
                            let totalPct = 0;
                            e.QuizSubmissions.forEach(sub => {
                                const score = parseFloat(sub.score) || 0;
                                const maxMarks = sub.Quiz?.total_marks ? parseFloat(sub.Quiz.total_marks) : 100;
                                totalPct += (score / maxMarks) * 100;
                            });
                            avgQuizScore = totalPct / e.QuizSubmissions.length;
                        }

                        // Calculate attendance percent
                        let attendancePct = 0;
                        const totalBatchSessions = batchSessionsCount[e.batch_id] || 0;
                        if (totalBatchSessions > 0) {
                            const presentCount = e.attendances ? e.attendances.filter(a => a.status === 'present' || a.status === 'late').length : 0;
                            attendancePct = (presentCount / totalBatchSessions) * 100;
                        } else {
                            attendancePct = 100;
                        }

                        if (avgQuizScore < 60 || attendancePct < 75) {
                            newCount++;
                        }
                    }
                }

                // Read previous count from institution_at_risk_snapshot
                const InstitutionAtRiskSnapshot = require('../models').InstitutionAtRiskSnapshot;
                let snapshot = await InstitutionAtRiskSnapshot.findOne({ where: { institution_id } });
                let previousCount = 0;
                if (!snapshot) {
                    snapshot = await InstitutionAtRiskSnapshot.create({
                        institution_id,
                        count: 0
                    });
                } else {
                    previousCount = snapshot.count;
                }

                if (newCount > previousCount) {
                    // Update snapshot with new count
                    snapshot.count = newCount;
                    await snapshot.save();

                    // Find institution_rep user
                    const repUser = await User.findOne({
                        where: {
                            role: 'institution_representative',
                            institution_id
                        }
                    });
                    if (repUser) {
                        await createNotification({
                            userId: repUser.id,
                            role: 'institution_representative',
                            type: 'AT_RISK_INCREASED',
                            title: 'At-Risk Students Increased',
                            message: `The number of at-risk students in your institution has increased to ${newCount}. Immediate review recommended.`,
                            referenceId: institution_id,
                            referenceType: 'institution'
                        });
                    }
                }
            }
        } catch (err) {
            // silent try-catch
        }

        return {
            saved_attendance: markedRecords,
            skipped_invalid_students: skippedRecords
        };
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
                            model: require('../models').Student,
                            attributes: ['id', 'first_name', 'last_name', 'email']
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
