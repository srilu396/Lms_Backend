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
        const skippedRecords = [];
        
        // --- PRE-CALCULATE FOR TRIGGER 7 ---
        let prevAttendance = {};
        let totalWorkingDays = 0;
        let studentIds = attendanceData.map(r => r.student_id);
        const { sequelize, Student } = require('../models');
        try {
            totalWorkingDays = await AttendanceSession.count({ where: { batch_id: session.batch_id } });
            if (totalWorkingDays > 0 && studentIds.length > 0) {
                const [prevCounts] = await sequelize.query(`
                    SELECT sa.student_id, COUNT(*) as present_days
                    FROM student_attendance sa
                    JOIN attendance_sessions asession ON sa.session_id = asession.id
                    WHERE asession.batch_id = :batchId AND sa.student_id IN (:studentIds) AND sa.status IN ('present', 'late')
                    GROUP BY sa.student_id
                `, { replacements: { batchId: session.batch_id, studentIds } });
                
                for (const row of prevCounts) {
                    prevAttendance[row.student_id] = (parseInt(row.present_days) / totalWorkingDays) * 100;
                }
            }
        } catch (err) {}
        // --- END PRE-CALC ---

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
            } catch (err) {
                skippedRecords.push({
                    student_id,
                    reason: `Database error: failed to save record. ${err.message}`
                });
            }
        }

        // --- NOTIFICATION TRIGGERS 4 & 7 ---
        try {
            const { createNotification } = require('../notifications/notification.service');
            
            // Trigger 7: Student Attendance Warning
            if (totalWorkingDays > 0 && studentIds.length > 0) {
                const [newCounts] = await sequelize.query(`
                    SELECT sa.student_id, COUNT(*) as present_days
                    FROM student_attendance sa
                    JOIN attendance_sessions asession ON sa.session_id = asession.id
                    WHERE asession.batch_id = :batchId AND sa.student_id IN (:studentIds) AND sa.status IN ('present', 'late')
                    GROUP BY sa.student_id
                `, { replacements: { batchId: session.batch_id, studentIds } });
                
                const newAttendance = {};
                for (const row of newCounts) {
                    newAttendance[row.student_id] = (parseInt(row.present_days) / totalWorkingDays) * 100;
                }

                for (const student_id of studentIds) {
                    const prevPct = prevAttendance[student_id] || 0;
                    const newPct = newAttendance[student_id] || 0;
                    
                    if (prevPct >= 75 && newPct < 75) {
                        const st = await Student.findByPk(student_id);
                        if (st && st.user_id) {
                            await createNotification({
                                userId: st.user_id,
                                role: 'student',
                                type: 'ATTENDANCE_WARNING',
                                title: 'Attendance Warning',
                                message: `Your attendance has dropped to ${newPct.toFixed(2)}%. The minimum required attendance is 75%. Please attend your sessions regularly.`,
                                referenceId: session.batch_id,
                                referenceType: 'attendance'
                            });
                        }
                    }
                }
            }

            // Trigger 4: Institution Rep At-Risk Count Increased
            const batch = await Batch.findByPk(session.batch_id);
            if (batch && batch.institution_id) {
                const institutionId = batch.institution_id;
                const [atRiskData] = await sequelize.query(`
                    WITH student_batches AS (
                        SELECT e.student_id, b.id as batch_id, b.institution_id
                        FROM enrollments e
                        JOIN batches b ON e.batch_id = b.id
                        WHERE b.institution_id = :institutionId AND e.status = 'active'
                    ),
                    attendance_stats AS (
                        SELECT 
                            sb.student_id,
                            COUNT(asession.id) as total_days,
                            SUM(CASE WHEN sa.status IN ('present', 'late') THEN 1 ELSE 0 END) as present_days
                        FROM student_batches sb
                        JOIN attendance_sessions asession ON asession.batch_id = sb.batch_id
                        LEFT JOIN student_attendance sa ON sa.session_id = asession.id AND sa.student_id = sb.student_id
                        GROUP BY sb.student_id
                    ),
                    quiz_stats AS (
                        SELECT 
                            sb.student_id,
                            COUNT(qs.id) as total_quizzes,
                            SUM(CASE WHEN qq_total.total_score > 0 THEN (qs.score::float / qq_total.total_score) * 100 ELSE 0 END) as sum_pct
                        FROM student_batches sb
                        JOIN quiz_submissions qs ON qs.student_id = sb.student_id AND qs.status = 'completed'
                        JOIN enrollments e ON e.id = qs.enrollment_id AND e.batch_id = sb.batch_id
                        LEFT JOIN LATERAL (
                            SELECT COALESCE(SUM(marks), COUNT(*)) as total_score FROM quiz_questions WHERE quiz_id = qs.quiz_id
                        ) qq_total ON true
                        GROUP BY sb.student_id
                    )
                    SELECT sb.student_id
                    FROM student_batches sb
                    LEFT JOIN attendance_stats ast ON ast.student_id = sb.student_id
                    LEFT JOIN quiz_stats qst ON qst.student_id = sb.student_id
                    WHERE 
                        (ast.total_days > 0 AND (ast.present_days::float / ast.total_days) * 100 < 75)
                        OR
                        (qst.total_quizzes > 0 AND (qst.sum_pct / qst.total_quizzes) < 60)
                    GROUP BY sb.student_id
                `, { replacements: { institutionId } });

                const newAtRiskCount = atRiskData.length;
                
                const [snapshotResult] = await sequelize.query(`
                    SELECT at_risk_count FROM institution_at_risk_snapshot WHERE institution_id = :institutionId
                `, { replacements: { institutionId } });
                
                let previousCount = null;
                if (snapshotResult.length > 0) {
                    previousCount = parseInt(snapshotResult[0].at_risk_count);
                }
                
                if (previousCount === null || newAtRiskCount > previousCount) {
                    const instRep = await User.findOne({ where: { role: 'institution_representative', institution_id: institutionId } });
                    if (instRep) {
                        await createNotification({
                            userId: instRep.id,
                            role: 'institution_representative',
                            type: 'AT_RISK_INCREASED',
                            title: 'At-Risk Students Increased',
                            message: `The number of at-risk students in your institution has increased to ${newAtRiskCount}. Immediate review recommended.`,
                            referenceId: institutionId,
                            referenceType: 'institution'
                        });
                    }
                    
                    if (previousCount === null) {
                        await sequelize.query(`
                            INSERT INTO institution_at_risk_snapshot (institution_id, at_risk_count, updated_at)
                            VALUES (:institutionId, :count, CURRENT_TIMESTAMP)
                        `, { replacements: { institutionId, count: newAtRiskCount } });
                    } else {
                        await sequelize.query(`
                            UPDATE institution_at_risk_snapshot 
                            SET at_risk_count = :count, updated_at = CURRENT_TIMESTAMP
                            WHERE institution_id = :institutionId
                        `, { replacements: { institutionId, count: newAtRiskCount } });
                    }
                }
            }
        } catch (err) {}
        // --- END NOTIFICATION TRIGGERS ---

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
