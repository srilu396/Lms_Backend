const { 
    Batch, 
    Enrollment, 
    QuizSubmission, 
    Quiz, 
    AssignmentSubmission, 
    BatchAssignment, 
    AttendanceSession, 
    StudentAttendance,
    Student,
    sequelize 
} = require('../../models');
const { Op } = require('sequelize');

class DashboardService {
    /**
     * Get dashboard statistics for an institution
     * @param {number} institutionId 
     */
    async getStats(institutionId) {
        // Step 1: Batches
        const activeCount = await Batch.count({ 
            where: { 
                institution_id: institutionId, 
                status: 'active' 
            } 
        });
        
        const pendingGraduation = await Batch.count({ 
            where: { 
                institution_id: institutionId, 
                status: 'completed' // Interpreted as 'pending_graduation' or equivalent
            } 
        });

        // Step 2: Avg Quiz Score & Trend
        const now = new Date();
        const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        
        // Next month start for boundary
        const firstDayNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        const avgQuizScoreOverall = await this._getAverageQuizScore(institutionId);
        const avgQuizScoreCurrentMonth = await this._getAverageQuizScore(institutionId, firstDayThisMonth, firstDayNextMonth);
        const avgQuizScorePrevMonth = await this._getAverageQuizScore(institutionId, firstDayLastMonth, firstDayThisMonth);

        const diff = avgQuizScoreCurrentMonth - avgQuizScorePrevMonth;
        const trendValue = diff.toFixed(1);
        const trendDirection = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'stable');
        const trendFormatted = (diff > 0 ? '+' : '') + trendValue;

        // Step 3: Completion Rate
        // Get all batches to calculate expected assignments (student count * assignment count)
        const batches = await Batch.findAll({
            where: { institution_id: institutionId },
            include: [
                { model: Enrollment, attributes: ['id'] },
                { model: BatchAssignment, attributes: ['id'] }
            ]
        });

        let totalAssigned = 0;
        const batchIds = [];
        batches.forEach(b => {
            batchIds.push(b.id);
            totalAssigned += (b.Enrollments.length * b.BatchAssignments.length);
        });

        // Get actual submissions
        const totalSubmitted = await AssignmentSubmission.count({
            include: [{
                model: Enrollment,
                required: true,
                where: { batch_id: { [Op.in]: batchIds } }
            }],
            where: { 
                status: { [Op.in]: ['submitted', 'graded'] } 
            }
        });

        const completionRate = totalAssigned > 0 
            ? parseFloat(((totalSubmitted / totalAssigned) * 100).toFixed(1))
            : 0;
        
        let completionLabel = 'Needs Attention';
        if (completionRate >= 90) completionLabel = 'Stable';
        else if (completionRate >= 70) completionLabel = 'Good';

        // Step 4: At Risk Students
        // Fetch enrollments with their submissions and attendance for calculation
        const enrollments = await Enrollment.findAll({
            where: { batch_id: { [Op.in]: batchIds } },
            include: [
                { 
                    model: QuizSubmission, 
                    include: [{ model: Quiz, attributes: ['total_marks'] }] 
                },
                { model: StudentAttendance }
            ]
        });

        // Get total sessions per batch for attendance calculation
        const batchSessions = await AttendanceSession.findAll({
            where: { batch_id: { [Op.in]: batchIds } },
            attributes: ['batch_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            group: ['batch_id'],
            raw: true
        });
        
        const batchSessionMap = {};
        batchSessions.forEach(s => {
            batchSessionMap[s.batch_id] = parseInt(s.count);
        });

        let atRiskCount = 0;
        enrollments.forEach(e => {
            // Student Avg Quiz Score for at-risk check
            let studentAvgScore = 0;
            if (e.QuizSubmissions && e.QuizSubmissions.length > 0) {
                let totalPct = 0;
                e.QuizSubmissions.forEach(sub => {
                    const score = parseFloat(sub.score) || 0;
                    const maxMarks = (sub.Quiz && sub.Quiz.total_marks) ? parseFloat(sub.Quiz.total_marks) : 100;
                    totalPct += (score / maxMarks) * 100;
                });
                studentAvgScore = totalPct / e.QuizSubmissions.length;
            } else {
                // If no quizzes taken, we assume 0 for score-based risk check
                studentAvgScore = 0;
            }

            // Student Attendance Percent
            let attendancePct = 0;
            const totalBatchSessions = batchSessionMap[e.batch_id] || 0;
            if (totalBatchSessions > 0) {
                const presentCount = e.StudentAttendances.filter(a => a.status === 'present' || a.status === 'late').length;
                attendancePct = (presentCount / totalBatchSessions) * 100;
            } else {
                // If no sessions, they are not failing attendance
                attendancePct = 100; 
            }

            if (studentAvgScore < 60 || attendancePct < 75) {
                atRiskCount++;
            }
        });

        let urgencyLabel = 'Under control';
        if (atRiskCount > 10) urgencyLabel = 'Needs immediate action';
        else if (atRiskCount > 5) urgencyLabel = 'Monitor closely';

        return {
            avg_quiz_score: {
                value: avgQuizScoreOverall,
                trend: trendFormatted,
                trend_direction: trendDirection
            },
            completion_rate: {
                value: completionRate,
                label: completionLabel
            },
            total_batches: {
                active_count: activeCount,
                pending_graduation: pendingGraduation
            },
            at_risk_students: {
                count: atRiskCount,
                today_change: 0, // Cannot reliably determine historical change without snapshotting
                urgency_label: urgencyLabel
            }
        };
    }

    /**
     * Get monitoring list (at-risk and warning students)
     */
    async getMonitoringList(institutionId, { page, limit, search, batch_id }) {
        // Step 1: Get all batches for this institution
        const allBatches = await Batch.findAll({
            where: { institution_id: institutionId },
            attributes: ['id', 'name']
        });

        const batchFilters = allBatches.map(b => ({ batch_id: b.id, batch_name: b.name }));
        let targetBatchIds = allBatches.map(b => b.id);

        if (batch_id && batch_id !== 'all') {
            const selectedBatchId = parseInt(batch_id);
            if (!targetBatchIds.includes(selectedBatchId)) {
                throw new Error('Unauthorized batch access');
            }
            targetBatchIds = [selectedBatchId];
        }

        if (targetBatchIds.length === 0) {
            return {
                students: [],
                batch_filters: batchFilters,
                pagination: { page, limit, total: 0, totalPages: 0 }
            };
        }

        // Step 2 & 3: Get all students and calculate metrics
        const enrollments = await Enrollment.findAll({
            where: { batch_id: { [Op.in]: targetBatchIds } },
            include: [
                {
                    model: Student,
                    as: 'student',
                    attributes: ['id', 'first_name', 'last_name']
                },
                {
                    model: Batch,
                    attributes: ['id', 'name']
                },
                {
                    model: QuizSubmission,
                    include: [{ model: Quiz, attributes: ['total_marks'] }]
                },
                {
                    model: StudentAttendance
                }
            ]
        });

        // Get total sessions per batch for attendance calculation
        const batchSessions = await AttendanceSession.findAll({
            where: { batch_id: { [Op.in]: targetBatchIds } },
            attributes: ['batch_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            group: ['batch_id'],
            raw: true
        });
        
        const batchSessionMap = {};
        batchSessions.forEach(s => {
            batchSessionMap[s.batch_id] = parseInt(s.count);
        });

        let students = enrollments.map(e => {
            // Avg Quiz Score
            let avgQuizScore = 0;
            if (e.QuizSubmissions && e.QuizSubmissions.length > 0) {
                let totalPct = 0;
                let count = 0;
                e.QuizSubmissions.forEach(sub => {
                    const score = parseFloat(sub.score) || 0;
                    const maxMarks = (sub.Quiz && sub.Quiz.total_marks) ? parseFloat(sub.Quiz.total_marks) : 100;
                    totalPct += (score / maxMarks) * 100;
                    count++;
                });
                avgQuizScore = count > 0 ? parseFloat((totalPct / count).toFixed(1)) : 0.0;
            }

            // Attendance
            let sessionsAttended = 0;
            let totalSessions = batchSessionMap[e.batch_id] || 0;
            let attendancePercent = 0;

            if (totalSessions > 0) {
                sessionsAttended = e.StudentAttendances.filter(a => a.status === 'present' || a.status === 'late').length;
                attendancePercent = Math.round((sessionsAttended / totalSessions) * 100);
            } else {
                attendancePercent = 100;
            }

            // Status logic
            let status = 'on_track';
            if (avgQuizScore < 50 || attendancePercent < 65) {
                status = 'critical';
            } else if (avgQuizScore < 70 || attendancePercent < 75) {
                status = 'warning';
            }

            return {
                student_id: e.student ? e.student.id : null,
                student_name: e.student ? `${e.student.first_name} ${e.student.last_name}` : 'Unknown',
                avatar_url: null,
                batch_id: e.Batch ? e.Batch.id : null,
                batch_name: e.Batch ? e.Batch.name : 'Unknown',
                avg_quiz_score: avgQuizScore,
                attendance_percent: attendancePercent,
                sessions_attended: sessionsAttended,
                total_sessions: totalSessions,
                status: status
            };
        });

        // Step 4: Filter - include ONLY critical or warning
        students = students.filter(s => s.status === 'critical' || s.status === 'warning');

        // Step 6: Apply search filter
        if (search) {
            const lowerSearch = search.toLowerCase();
            students = students.filter(s => s.student_name.toLowerCase().includes(lowerSearch));
        }

        // Step 5: Sort - critical first, then warning. Within groups, lowest avg_quiz_score first.
        students.sort((a, b) => {
            if (a.status === b.status) {
                return a.avg_quiz_score - b.avg_quiz_score;
            }
            return a.status === 'critical' ? -1 : 1;
        });

        // Step 6: Apply pagination
        const total = students.length;
        const totalPages = Math.ceil(total / limit);
        const paginatedStudents = students.slice((page - 1) * limit, page * limit);

        return {
            students: paginatedStudents,
            batch_filters: batchFilters,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        };
    }

    /**
     * Helper to get average quiz score percent for an institution in a date range
     */
    async _getAverageQuizScore(institutionId, startDate = null, endDate = null) {
        const where = {};
        if (startDate && endDate) {
            where.submitted_at = { [Op.between]: [startDate, endDate] };
        }

        const submissions = await QuizSubmission.findAll({
            where,
            include: [
                {
                    model: Quiz,
                    required: true,
                    attributes: ['total_marks']
                },
                {
                    model: Enrollment,
                    required: true,
                    attributes: ['id'],
                    include: [{
                        model: Batch,
                        required: true,
                        where: { institution_id: institutionId },
                        attributes: ['id']
                    }]
                }
            ]
        });

        if (submissions.length === 0) return 0;

        let totalPct = 0;
        submissions.forEach(sub => {
            const score = parseFloat(sub.score) || 0;
            const maxMarks = (sub.Quiz && sub.Quiz.total_marks) ? parseFloat(sub.Quiz.total_marks) : 100;
            totalPct += (score / maxMarks) * 100;
        });

        return parseFloat((totalPct / submissions.length).toFixed(1));
    }
}

module.exports = new DashboardService();
