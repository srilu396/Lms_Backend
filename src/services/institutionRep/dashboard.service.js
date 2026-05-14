const { 
    Batch, 
    Enrollment, 
    QuizSubmission, 
    Quiz, 
    AssignmentSubmission, 
    BatchAssignment, 
    AttendanceSession, 
    StudentAttendance, 
    User,
    StudentRiskReport,
    sequelize 
} = require('../../models');
const { Op } = require('sequelize');
const moment = require('moment');

class DashboardService {
    /**
     * Get dashboard overview data for an institution
     */
    async getOverview(institutionId) {
        // 1. KPI Cards
        const kpi = await this.calculateKPIs(institutionId);

        // 2. Attendance Trends Chart
        const attendanceTrends = await this.getAttendanceTrends(institutionId);

        return { kpi, attendance_trends: attendanceTrends };
    }

    async calculateKPIs(institutionId) {
        // Find active batches for this institution
        const activeBatches = await Batch.findAll({
            where: {
                institution_id: institutionId,
                status: 'active'
            },
            attributes: ['id', 'end_date']
        });

        const activeBatchIds = activeBatches.map(b => b.id);

        // Card 1: avg_quiz_score
        const avgQuizScoreData = await this.calculateAvgQuizScore(activeBatchIds);

        // Card 2: completion_rate
        const completionRateData = await this.calculateCompletionRate(activeBatchIds);

        // Card 3: total_batches
        const totalBatchesData = await this.calculateTotalBatches(institutionId);

        // Card 4: at_risk_students
        const atRiskStudentsData = await this.calculateAtRiskStudents(institutionId, activeBatchIds);

        return {
            avg_quiz_score: avgQuizScoreData,
            completion_rate: completionRateData,
            total_batches: totalBatchesData,
            at_risk_students: atRiskStudentsData
        };
    }

    async calculateAvgQuizScore(batchIds) {
        if (batchIds.length === 0) return { value: 0, trend_value: '+0.0', trend_direction: 'stable' };

        // Get all students in these batches
        const enrollments = await Enrollment.findAll({
            where: { batch_id: batchIds },
            attributes: ['student_id']
        });
        const studentIds = enrollments.map(e => e.student_id);

        if (studentIds.length === 0) return { value: 0, trend_value: '+0.0', trend_direction: 'stable' };

        const now = moment();
        const thirtyDaysAgo = moment().subtract(30, 'days').toDate();
        const sixtyDaysAgo = moment().subtract(60, 'days').toDate();

        // Helper to calculate average for a date range
        const getAvgForRange = async (startDate, endDate) => {
            const submissions = await QuizSubmission.findAll({
                where: {
                    student_id: studentIds,
                    submitted_at: {
                        [Op.gte]: startDate,
                        ...(endDate ? { [Op.lt]: endDate } : {})
                    }
                },
                include: [{
                    model: Quiz,
                    attributes: ['total_marks']
                }]
            });

            if (submissions.length === 0) return 0;

            let totalPercent = 0;
            let validSubmissions = 0;

            submissions.forEach(sub => {
                if (sub.Quiz && sub.Quiz.total_marks > 0) {
                    const percent = (sub.score / sub.Quiz.total_marks) * 100;
                    totalPercent += percent;
                    validSubmissions++;
                }
            });

            return validSubmissions > 0 ? totalPercent / validSubmissions : 0;
        };

        const currentAvg = await getAvgForRange(thirtyDaysAgo, null);
        const previousAvg = await getAvgForRange(sixtyDaysAgo, thirtyDaysAgo);

        const trendValue = (currentAvg - previousAvg).toFixed(1);
        const formattedTrend = trendValue >= 0 ? `+${trendValue}` : trendValue.toString();
        let trendDirection = 'stable';
        if (parseFloat(trendValue) > 0) trendDirection = 'up';
        if (parseFloat(trendValue) < 0) trendDirection = 'down';

        return {
            value: parseFloat(currentAvg.toFixed(1)),
            trend_value: formattedTrend,
            trend_direction: trendDirection
        };
    }

    async calculateCompletionRate(batchIds) {
        if (batchIds.length === 0) return { value: 0, stability_label: 'At Risk' };

        // total_assignments_assigned = sum of all assignments assigned across all students in all batches
        // total_assignments_submitted = count of actual submissions

        let totalAssigned = 0;
        let totalSubmitted = 0;

        for (const batchId of batchIds) {
            const studentCount = await Enrollment.count({ where: { batch_id: batchId } });
            const assignmentCount = await BatchAssignment.count({ 
                where: { 
                    batch_id: batchId,
                    status: 'active'
                } 
            });
            totalAssigned += (studentCount * assignmentCount);

            // Submissions for this batch
            const batchStudentIds = (await Enrollment.findAll({ 
                where: { batch_id: batchId },
                attributes: ['student_id']
            })).map(e => e.student_id);

            if (batchStudentIds.length > 0) {
                // Count submissions for assignments belonging to this batch
                const batchAssignmentIds = (await BatchAssignment.findAll({
                    where: { batch_id: batchId },
                    attributes: ['assignment_id']
                })).map(ba => ba.assignment_id);

                if (batchAssignmentIds.length > 0) {
                    const submissionsCount = await AssignmentSubmission.count({
                        where: {
                            student_id: batchStudentIds,
                            assignment_id: batchAssignmentIds
                        }
                    });
                    totalSubmitted += submissionsCount;
                }
            }
        }

        const completionRate = totalAssigned > 0 ? (totalSubmitted / totalAssigned) * 100 : 0;
        
        let stabilityLabel = 'At Risk';
        if (completionRate >= 90) stabilityLabel = 'Stable';
        else if (completionRate >= 70) stabilityLabel = 'Moderate';

        return {
            value: parseFloat(completionRate.toFixed(1)),
            stability_label: stabilityLabel
        };
    }

    async calculateTotalBatches(institutionId) {
        const activeCount = await Batch.count({
            where: {
                institution_id: institutionId,
                status: 'active'
            }
        });

        // pending_graduation_count: status = 'completed' but graduation not yet cleared 
        // OR count batches where end_date has passed but status is still 'active'
        const now = moment().format('YYYY-MM-DD');
        const pendingCount = await Batch.count({
            where: {
                institution_id: institutionId,
                [Op.or]: [
                    { status: 'completed' }, // Assuming graduation not cleared means status is completed but we don't have a flag
                    {
                        status: 'active',
                        end_date: { [Op.lt]: now }
                    }
                ]
            }
        });

        return {
            active_count: activeCount,
            pending_graduation_count: pendingCount
        };
    }

    async calculateAtRiskStudents(institutionId, batchIds) {
        if (batchIds.length === 0) return { at_risk_count: 0, daily_change: '0', urgency_label: 'Under control' };

        // For each student, we need avg_quiz_score and attendance_percent
        // This is expensive to calculate on the fly for all students.
        // Let's see if we can use StudentRiskReport or calculate it efficiently.
        
        // We'll calculate it for active batches.
        const enrollments = await Enrollment.findAll({
            where: { batch_id: batchIds },
            attributes: ['student_id', 'batch_id', 'id']
        });

        let atRiskCount = 0;

        // Optimization: Use a subquery or join if possible, but let's stick to the logic for now.
        // To handle daily_change, we really need historical data.
        // Let's check StudentRiskReport for yesterday.
        
        const today = moment().startOf('day').toDate();
        const yesterday = moment().subtract(1, 'days').startOf('day').toDate();

        // Count current at-risk (simplified: use StudentRiskReport if it's up to date, or calculate)
        // The user says: "at_risk_count: count of students where avg_quiz_score < 60 OR attendance_percent < 60"
        
        // Let's use the most recent StudentRiskReport for each enrollment
        const latestReports = await StudentRiskReport.findAll({
            where: {
                batch_id: batchIds,
                report_date: { [Op.gte]: moment().subtract(1, 'day').toDate() }
            },
            order: [['report_date', 'DESC']]
        });

        // If no reports today, we might need to calculate.
        // But the user request implies we should have this data.
        
        // Let's perform a manual calculation for "Current"
        // and use StudentRiskReport for "Yesterday" to get daily_change.

        // Manual Calculation for Current:
        // (This might be slow if there are thousands of students, but it's the most accurate)
        // Alternatively, we can use the StudentRiskReport table which seems intended for this.
        
        const getCurrentAtRiskCount = async (date) => {
             // In a real system, this would be a complex query or a pre-calculated table.
             // For this task, I'll count records in StudentRiskReport for that date 
             // where risk_status is 'critical' or 'warning' (or use the raw fields).
             const count = await StudentRiskReport.count({
                 where: {
                     batch_id: batchIds,
                     report_date: {
                         [Op.gte]: moment(date).startOf('day').toDate(),
                         [Op.lte]: moment(date).endOf('day').toDate()
                     },
                     [Op.or]: [
                         { avg_quiz_score: { [Op.lt]: 60 } },
                         { attendance_percentage: { [Op.lt]: 60 } }
                     ]
                 }
             });
             return count;
        };

        const currentCount = await getCurrentAtRiskCount(new Date());
        const yesterdayCount = await getCurrentAtRiskCount(moment().subtract(1, 'day').toDate());

        const change = currentCount - yesterdayCount;
        let dailyChange = change.toString();
        if (change > 0) dailyChange = `+${change}`;

        let urgencyLabel = 'Under control';
        if (currentCount > 10) urgencyLabel = 'Needs immediate action';
        else if (currentCount >= 5) urgencyLabel = 'Monitor closely';

        return {
            at_risk_count: currentCount,
            daily_change: dailyChange,
            urgency_label: urgencyLabel
        };
    }

    async getAttendanceTrends(institutionId) {
        const activeBatches = await Batch.findAll({
            where: {
                institution_id: institutionId,
                status: 'active'
            },
            attributes: ['id']
        });

        const batchIds = activeBatches.map(b => b.id);
        if (batchIds.length === 0) return [];

        const trends = [];
        const thirtyDaysAgo = moment().subtract(30, 'days');

        // Loop through last 30 days
        for (let i = 0; i < 30; i++) {
            const date = moment().subtract(29 - i, 'days').format('YYYY-MM-DD');
            const formattedDate = moment(date).format('MMM DD').toUpperCase();

            // Find sessions on this day for these batches
            const sessions = await AttendanceSession.findAll({
                where: {
                    batch_id: batchIds,
                    session_date: date
                }
            });

            if (sessions.length === 0) continue;

            const sessionIds = sessions.map(s => s.id);
            const batchIdsWithSessions = [...new Set(sessions.map(s => s.batch_id))];

            // present_percent = (total students marked present / total students who had a session) * 100
            
            // Total students who had a session: Sum of enrollments in batches that had a session today
            const totalStudents = await Enrollment.count({
                where: { batch_id: batchIdsWithSessions }
            });

            // Total students marked present
            const presentCount = await StudentAttendance.count({
                where: {
                    session_id: sessionIds,
                    status: 'present'
                }
            });

            const presentPercent = totalStudents > 0 ? (presentCount / totalStudents) * 100 : 0;

            trends.push({
                date: formattedDate,
                present_percent: Math.round(presentPercent),
                benchmark_percent: 75 // Default as per request
            });
        }

        return trends;
    }
}

module.exports = new DashboardService();
