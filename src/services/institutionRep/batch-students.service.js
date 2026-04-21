const { 
    Batch, 
    Student, 
    Enrollment, 
    QuizSubmission, 
    AssignmentSubmission, 
    BatchAssignment,
    AttendanceSession,
    StudentAttendance,
    Quiz,
    sequelize
} = require('../../models');
const { Op } = require('sequelize');

class BatchStudentsService {
    /**
     * Get students table for a specific batch with metrics
     */
    async getBatchStudents(batchId, institutionId, queryParams) {
        const { page = 1, limit = 10, search = '', status = '' } = queryParams;
        const offset = (page - 1) * limit;

        // 1. Verify batch belongs to institution
        const batch = await Batch.findOne({
            where: { id: batchId, institution_id: institutionId }
        });

        if (!batch) {
            const error = new Error('Batch not found or access denied');
            error.statusCode = 403;
            throw error;
        }

        // 2. Constants for metrics
        const totalWorkingDays = await AttendanceSession.count({
            where: { batch_id: batchId }
        });

        const totalAssignments = await BatchAssignment.count({
            where: { batch_id: batchId }
        });

        // 3. Fetch all enrollments for this batch that match search criteria
        // We'll calculate metrics and filter by status in memory since we need derived fields
        const allEnrollments = await Enrollment.findAll({
            where: { batch_id: batchId },
            include: [
                {
                    model: Student,
                    as: 'student',
                    where: search ? {
                        [Op.or]: [
                            { first_name: { [Op.like]: `%${search}%` } },
                            { last_name: { [Op.like]: `%${search}%` } }
                        ]
                    } : {}
                }
            ]
        });

        const studentsData = await Promise.all(allEnrollments.map(async (enrollment) => {
            const student = enrollment.student;

            // Attendance %
            let attendancePercent = 0;
            if (totalWorkingDays > 0) {
                const presentDays = await StudentAttendance.count({
                    where: { 
                        enrollment_id: enrollment.id,
                        status: 'present'
                    }
                });
                attendancePercent = Math.round((presentDays / totalWorkingDays) * 100);
            }

            // Quiz Avg
            const quizAvgResult = await QuizSubmission.findOne({
                where: { enrollment_id: enrollment.id },
                attributes: [
                    [sequelize.fn('AVG', sequelize.col('score')), 'avgScore']
                ],
                raw: true
            });
            const quizAvg = parseFloat(parseFloat(quizAvgResult.avgScore || 0).toFixed(1));

            // Assignments
            const assignmentsCompleted = await AssignmentSubmission.count({
                where: { 
                    enrollment_id: enrollment.id,
                    status: { [Op.in]: ['submitted', 'graded'] }
                }
            });

            // Calculate Status
            // excellent: quiz_avg >= 81
            // at_risk: attendance < 75 OR quiz_avg < 40
            // on_track: else
            let calculatedStatus = 'on_track';
            if (quizAvg >= 81) {
                calculatedStatus = 'excellent';
            } else if (attendancePercent < 75 || quizAvg < 40) {
                calculatedStatus = 'at_risk';
            }

            return {
                student_id: student.id,
                student_name: `${student.first_name} ${student.last_name}`,
                avatar_url: null,
                attendance_percent: attendancePercent,
                quiz_avg: quizAvg,
                assignments_completed: assignmentsCompleted,
                assignments_total: totalAssignments,
                status: calculatedStatus
            };
        }));

        // 4. Filter by status if provided
        let filteredStudents = studentsData;
        if (status) {
            filteredStudents = studentsData.filter(s => s.status === status);
        }

        // 5. Paginate
        const total = filteredStudents.length;
        const paginatedStudents = filteredStudents.slice(offset, offset + limit);

        return {
            students: paginatedStudents,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get detailed student profile with stats for a batch
     */
    async getStudentProfile(batchId, studentId, institutionId) {
        // 1. Verify batch ownership and student enrollment
        const batch = await Batch.findOne({
            where: { id: batchId, institution_id: institutionId }
        });

        if (!batch) {
            const error = new Error('Batch not found or access denied');
            error.statusCode = 403;
            throw error;
        }

        const enrollment = await Enrollment.findOne({
            where: { batch_id: batchId, student_id: studentId },
            include: [{ model: Student, as: 'student' }]
        });

        if (!enrollment) {
            const error = new Error('Student not found in this batch');
            error.statusCode = 403;
            throw error;
        }

        const student = enrollment.student;

        // 2. Attendance Stats
        const totalWorkingDays = await AttendanceSession.count({
            where: { batch_id: batchId }
        });

        const presentDays = await StudentAttendance.count({
            where: { 
                enrollment_id: enrollment.id,
                status: { [Op.in]: ['present', 'late'] }
            }
        });

        const attendancePercent = totalWorkingDays > 0 
            ? Math.round((presentDays / totalWorkingDays) * 100) 
            : 0;

        let attendanceLabel = 'Below average attendance';
        if (attendancePercent >= 85) {
            attendanceLabel = 'Above average attendance';
        } else if (attendancePercent >= 75) {
            attendanceLabel = 'Average attendance';
        }

        // 3. Assessment Stats
        // Quizzes
        const totalQuizzes = await Quiz.count({
            where: { 
                course_id: batch.course_id, 
                status: 'published' 
            }
        });

        const completedQuizzes = await QuizSubmission.count({
            where: { enrollment_id: enrollment.id }
        });

        // Assignments
        const totalAssignments = await BatchAssignment.count({
            where: { batch_id: batchId }
        });

        const completedAssignments = await AssignmentSubmission.count({
            where: { 
                enrollment_id: enrollment.id,
                status: { [Op.in]: ['submitted', 'graded'] }
            }
        });

        const totalAssessments = totalQuizzes + totalAssignments;
        const completedAssessments = completedQuizzes + completedAssignments;
        
        const submissionRatePercent = totalAssessments > 0 
            ? Math.round((completedAssessments / totalAssessments) * 100) 
            : 0;

        // 4. Format Student ID: #STU-YYYY-XXX
        const enrollmentYear = student.created_at ? new Date(student.created_at).getFullYear() : '2024';
        const formattedStudentId = `#STU-${enrollmentYear}-${String(student.id).padStart(3, '0')}`;

        return {
            student_name: `${student.first_name} ${student.last_name}`,
            student_id: formattedStudentId,
            email: student.email,
            avatar_url: null, // Placeholder as per current schema
            status: student.status,
            overall_attendance_percent: attendancePercent,
            attendance_label: attendanceLabel,
            completed_assessments: completedAssessments,
            total_assessments: totalAssessments,
            submission_rate_percent: submissionRatePercent
        };
    }
}

module.exports = new BatchStudentsService();
