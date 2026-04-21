const { 
    Batch, 
    Course, 
    User, 
    Enrollment, 
    QuizSubmission, 
    AssignmentSubmission, 
    BatchAssignment,
    AttendanceSession,
    StudentAttendance,
    sequelize
} = require('../../models');
const { Op } = require('sequelize');

class BatchDetailsService {
    /**
     * Get overview stats for a specific batch
     */
    async getBatchOverview(batchId, institutionId) {
        // 1. Fetch Batch with Course and Primary Tutor
        const batch = await Batch.findOne({
            where: { id: batchId, institution_id: institutionId },
            include: [
                { 
                    model: Course,
                    attributes: ['id', 'name']
                },
                { 
                    model: User, 
                    as: 'tutor', 
                    attributes: ['id', 'full_name'] 
                }
            ]
        });

        if (!batch) {
            const error = new Error('Batch not found or access denied');
            error.statusCode = 403;
            throw error;
        }

        // 2. Total active students
        const totalActiveStudents = await Enrollment.count({
            where: { batch_id: batchId, status: 'active' }
        });

        const activeEnrollments = await Enrollment.findAll({
            where: { batch_id: batchId, status: 'active' },
            attributes: ['id', 'student_id']
        });
        const enrollmentIds = activeEnrollments.map(e => e.id);
        const studentIds = activeEnrollments.map(e => e.student_id);

        if (totalActiveStudents === 0) {
            return {
                batch_id: `#BATCH-${batch.id}`,
                batch_name: batch.name,
                course_name: batch.Course?.name || 'N/A',
                tutor: batch.tutor?.full_name || 'Unassigned',
                total_active_students: 0,
                batch_avg_score: 0,
                assignment_completion_percent: 0,
                at_risk_count: 0
            };
        }

        // 3. Batch Average Quiz Score
        // Average of all quiz scores submitted by students in this batch
        const avgQuizScoreResult = await QuizSubmission.findOne({
            where: { enrollment_id: { [Op.in]: enrollmentIds } },
            attributes: [
                [sequelize.fn('AVG', sequelize.col('score')), 'avgScore']
            ],
            raw: true
        });
        const batchAvgScore = Math.round(parseFloat(avgQuizScoreResult.avgScore || 0));

        // 4. Assignment Completion %
        // (total submitted assignments / total assigned assignments across all students in batch) × 100
        const totalAssignedAssignments = await BatchAssignment.count({
            where: { batch_id: batchId }
        });
        
        const totalExpectedSubmissions = totalAssignedAssignments * totalActiveStudents;
        
        let assignmentCompletionPercent = 0;
        if (totalExpectedSubmissions > 0) {
            const totalSubmittedAssignments = await AssignmentSubmission.count({
                where: { 
                    enrollment_id: { [Op.in]: enrollmentIds },
                    status: { [Op.in]: ['submitted', 'graded'] }
                }
            });
            assignmentCompletionPercent = Math.round((totalSubmittedAssignments / totalExpectedSubmissions) * 100);
        }

        // 5. At-Risk Students Count
        // Count of students whose attendance is below 75% OR avg quiz score is below 40
        const totalSessions = await AttendanceSession.count({
            where: { batch_id: batchId }
        });

        let atRiskCount = 0;

        for (const enrollment of activeEnrollments) {
            let isAtRisk = false;

            // Check Attendance
            if (totalSessions > 0) {
                const attendedSessions = await StudentAttendance.count({
                    where: { 
                        enrollment_id: enrollment.id,
                        status: { [Op.in]: ['present', 'late'] }
                    }
                });
                const attendancePercent = (attendedSessions / totalSessions) * 100;
                if (attendancePercent < 75) {
                    isAtRisk = true;
                }
            }

            // Check Quiz Score (if not already at risk)
            if (!isAtRisk) {
                const studentAvgQuizResult = await QuizSubmission.findOne({
                    where: { enrollment_id: enrollment.id },
                    attributes: [
                        [sequelize.fn('AVG', sequelize.col('score')), 'avgScore']
                    ],
                    raw: true
                });
                const studentAvgScore = parseFloat(studentAvgQuizResult.avgScore || 0);
                if (studentAvgScore < 40) {
                    // Only count if they have actually submitted something or if 0 is considered below 40
                    // Usually if they have 0 submissions, they might be at risk anyway.
                    // But here we check the average of what they submitted.
                    // If no submissions, avg is 0, so they are at risk.
                    isAtRisk = true;
                }
            }

            if (isAtRisk) {
                atRiskCount++;
            }
        }

        return {
            batch_id: `#BATCH-${batch.id}`,
            batch_name: batch.name,
            course_name: batch.Course?.name || 'N/A',
            tutor: batch.tutor?.full_name || 'Unassigned',
            total_active_students: totalActiveStudents,
            batch_avg_score: batchAvgScore,
            assignment_completion_percent: assignmentCompletionPercent,
            at_risk_count: atRiskCount
        };
    }
}

module.exports = new BatchDetailsService();
