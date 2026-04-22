const { 
    Batch, 
    Student, 
    Enrollment, 
    QuizSubmission, 
    AssignmentSubmission, 
    Quiz, 
    Assignment, 
    AttendanceSession, 
    StudentAttendance,
    sequelize
} = require('../../models');
const { Op } = require('sequelize');

class RecentActivityService {
    /**
     * Get recent assessments and attendance log for a student in a batch
     */
    async getRecentActivity(batchId, studentId, institutionId) {
        // 1. Verify batch belongs to institution
        const batch = await Batch.findOne({
            where: { id: batchId, institution_id: institutionId }
        });

        if (!batch) {
            const error = new Error('Batch not found or access denied');
            error.statusCode = 403;
            throw error;
        }

        // 2. Verify student belongs to batch
        const enrollment = await Enrollment.findOne({
            where: { batch_id: batchId, student_id: studentId }
        });

        if (!enrollment) {
            const error = new Error('Student not found in this batch');
            error.statusCode = 403;
            throw error;
        }

        // 3. Section 1: Recent Assessments (Last 4)
        const recentAssessments = await this._getRecentAssessments(enrollment.id, studentId);

        // 4. Section 2: Attendance Log (Last 7 scheduled days)
        const attendanceLog = await this._getAttendanceLog(batchId, studentId, enrollment.id);

        return {
            recent_assessments: recentAssessments,
            attendance_log: attendanceLog
        };
    }

    /**
     * Internal helper to fetch and format recent assessments
     */
    async _getRecentAssessments(enrollmentId, studentId) {
        // Fetch last 4 quiz submissions
        const quizSubmissions = await QuizSubmission.findAll({
            where: { enrollment_id: enrollmentId },
            include: [{ model: Quiz }], 
            order: [['submitted_at', 'DESC']],
            limit: 4
        });

        // Fetch last 4 assignment submissions
        const assignmentSubmissions = await AssignmentSubmission.findAll({
            where: { enrollment_id: enrollmentId },
            include: [{ model: Assignment }], 
            order: [['submitted_at', 'DESC']],
            limit: 4
        });

        // Map and combine
        const assessments = [
            ...quizSubmissions.map(qs => {
                const total = qs.Quiz?.total_marks || 0;
                const obtained = qs.score || 0;
                const percent = total > 0 ? Math.round((obtained / total) * 100) : 0;
                return {
                    assessment_title: qs.Quiz?.name || 'Quiz',
                    assessment_type: 'quiz',
                    submitted_date: this._formatDate(qs.submitted_at),
                    submitted_at_raw: qs.submitted_at,
                    score_obtained: parseFloat(obtained),
                    score_total: parseFloat(total),
                    score_percent: percent
                };
            }),
            ...assignmentSubmissions.map(as => {
                const total = as.Assignment?.max_score || 0;
                const obtained = as.grade || 0;
                const percent = total > 0 ? Math.round((obtained / total) * 100) : 0;
                return {
                    assessment_title: as.Assignment?.name || 'Assignment',
                    assessment_type: 'assignment',
                    submitted_date: this._formatDate(as.submitted_at),
                    submitted_at_raw: as.submitted_at,
                    score_obtained: parseFloat(obtained),
                    score_total: parseFloat(total),
                    score_percent: percent
                };
            })
        ];

        // Sort by raw date DESC and take top 4
        return assessments
            .sort((a, b) => new Date(b.submitted_at_raw) - new Date(a.submitted_at_raw))
            .slice(0, 4)
            .map(({ submitted_at_raw, ...rest }) => rest);
    }

    /**
     * Internal helper to fetch and format attendance log
     */
    async _getAttendanceLog(batchId, studentId, enrollmentId) {
        // Find the latest session date for the batch
        const latestSession = await AttendanceSession.findOne({
            where: { batch_id: batchId },
            order: [['session_date', 'DESC']]
        });

        if (!latestSession) {
            return [];
        }

        const latestDate = new Date(latestSession.session_date);
        const days = [];

        // Generate 7 consecutive days ending on latestDate
        for (let i = 0; i < 7; i++) {
            const d = new Date(latestDate);
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }

        // Fetch all sessions and attendance for these dates in one go
        const sessions = await AttendanceSession.findAll({
            where: { 
                batch_id: batchId,
                session_date: { [Op.in]: days }
            }
        });

        const attendanceRecords = await StudentAttendance.findAll({
            where: {
                enrollment_id: enrollmentId,
                session_id: { [Op.in]: sessions.map(s => s.id) }
            }
        });

        // Map dates to results
        const result = days.map(dayStr => {
            const session = sessions.find(s => s.session_date === dayStr);
            let status = 'no_class';

            if (session) {
                const record = attendanceRecords.find(r => r.session_id === session.id);
                status = record ? record.status : 'absent'; // Default to absent if session exists but no mark
            }

            return {
                date: this._formatDate(dayStr),
                status: status,
                raw_date: dayStr
            };
        });

        // Order by date ASC (oldest to newest)
        return result.sort((a, b) => new Date(a.raw_date) - new Date(b.raw_date))
            .map(({ raw_date, ...rest }) => rest);
    }

    /**
     * Format date to MMM DD (e.g., OCT 28)
     */
    _formatDate(date) {
        if (!date) return '';
        const d = new Date(date);
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        return `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}`;
    }
}

module.exports = new RecentActivityService();
