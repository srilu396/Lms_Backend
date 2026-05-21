const { 
    Batch, 
    Student, 
    Enrollment, 
    QuizSubmission, 
    AssignmentSubmission, 
    Assignment,
    BatchAssignment,
    AttendanceSession,
    StudentAttendance,
    Quiz,
    Course,
    Module,
    Topic,
    sequelize
} = require('../../models');
const { Op } = require('sequelize');
const { verifyBatchOwnership } = require('../../utils/institutionRep.helper');

class BatchStudentsService {
    /**
     * Get students table for a specific batch with metrics
     */
    async getBatchStudents(batchId, institutionId, queryParams) {
        const { page = 1, limit = 10, search = '', status = '' } = queryParams;
        const offset = (page - 1) * limit;

        // 1. Verify batch belongs to institution
        const batch = await verifyBatchOwnership(batchId, institutionId);

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
                    attributes: ['id', 'first_name', 'last_name', 'email', 'status', 'created_at'],
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
     * Get statistics for a specific student in a batch
     */
    async getStudentStats(batchId, studentId, institutionId) {
        // 1. Verify batch belongs to institution
        const batch = await verifyBatchOwnership(batchId, institutionId);

        // 2. Verify student is enrolled in this batch
        const enrollment = await Enrollment.findOne({
            where: { batch_id: batchId, student_id: studentId },
            include: [{ 
                model: Student, 
                as: 'student',
                attributes: ['id', 'first_name', 'last_name', 'email', 'status', 'created_at']
            }]
        });

        if (!enrollment) {
            const error = new Error('Student not found in this batch');
            error.statusCode = 403;
            throw error;
        }

        const student = enrollment.student;

        // Step 1: Student Basic Info
        const student_info = {
            student_id: `#STU-${new Date(student.created_at).getFullYear()}-${student.id.toString().padStart(3, '0')}`,
            student_name: `${student.first_name} ${student.last_name}`,
            email: student.email,
            avatar_url: student.avatar_url || null,
            status: student.status,
            batch_name: batch.name
        };

        // Step 2: Card 1 - Overall Attendance
        const total_working_days = await AttendanceSession.count({
            where: { batch_id: batchId }
        });

        const days_present = await StudentAttendance.count({
            where: { enrollment_id: enrollment.id, status: 'present' }
        });

        const attendance_percent = total_working_days > 0 
            ? Math.round((days_present / total_working_days) * 100) 
            : 0;

        let attendance_label = 'Below average attendance';
        if (attendance_percent >= 85) {
            attendance_label = 'Above average attendance';
        } else if (attendance_percent >= 75) {
            attendance_label = 'Average attendance';
        }

        const attendance = {
            attendance_percent,
            days_present,
            total_working_days,
            attendance_label
        };

        // Step 3: Card 2 - Completed Assessments (Assignments only)
        const assignments_submitted = await AssignmentSubmission.count({
            where: { 
                enrollment_id: enrollment.id,
                status: { [Op.in]: ['submitted', 'graded'] }
            }
        });

        const assignments_total = await BatchAssignment.count({
            where: { batch_id: batchId }
        });

        const submission_rate_percent = assignments_total > 0 
            ? Math.round((assignments_submitted / assignments_total) * 100) 
            : 0;

        const assessments = {
            assignments_submitted,
            assignments_total,
            submission_rate_percent
        };

        // Step 4: Card 3 - Completed Quizzes (Quizzes only)
        const quizzes_submitted_records = await QuizSubmission.findAll({
            where: { enrollment_id: enrollment.id },
            include: [{ model: Quiz, attributes: ['total_marks'] }]
        });

        const quizzes_submitted = quizzes_submitted_records.length;

        const quizzes_total = await Quiz.count({
            where: { 
                course_id: batch.course_id,
                is_published: true
            }
        });

        let total_score_percent = 0;
        quizzes_submitted_records.forEach(sub => {
            const total_marks = (sub.Quiz && sub.Quiz.total_marks) ? sub.Quiz.total_marks : 100;
            const score = parseFloat(sub.score || 0);
            total_score_percent += (score / total_marks) * 100;
        });

        const quiz_proficiency_percent = quizzes_submitted > 0 
            ? Math.round(total_score_percent / quizzes_submitted) 
            : 0;

        let proficiency_label = 'Needs Improvement';
        if (quiz_proficiency_percent >= 85) {
            proficiency_label = 'Excellent Proficiency';
        } else if (quiz_proficiency_percent >= 70) {
            proficiency_label = 'Good Proficiency';
        } else if (quiz_proficiency_percent >= 50) {
            proficiency_label = 'Average Proficiency';
        }

        const quizzes = {
            quizzes_submitted,
            quizzes_total,
            quiz_proficiency_percent,
            proficiency_label
        };

        return {
            student_info,
            attendance,
            assessments,
            quizzes
        };
    }

    /**
     * Get academic performance for a student in a batch
     */
    async getAcademicPerformance(batchId, studentId, institutionId, queryParams) {
        const { page = 1, limit = 10, search = '', type = 'all' } = queryParams;

        // 1. Verify batch belongs to institution
        const batch = await verifyBatchOwnership(batchId, institutionId);

        // 2. Verify student is enrolled in this batch
        const enrollment = await Enrollment.findOne({
            where: { batch_id: batchId, student_id: studentId }
        });

        if (!enrollment) {
            const error = new Error('Student not found in this batch');
            error.statusCode = 403;
            throw error;
        }

        let combinedSubmissions = [];

        // Fetch Assignments if type is 'all' or 'assignment'
        if (type === 'all' || type === 'assignment') {
            const assignmentSubmissions = await AssignmentSubmission.findAll({
                where: { enrollment_id: enrollment.id },
                attributes: ['id', 'grade', 'submitted_at', 'created_at', 'enrollment_id', 'assignment_id', 'status'],
                include: [
                    {
                        model: Assignment,
                        include: [
                            { model: Module, attributes: ['name'] },
                            { model: Topic, attributes: ['name'] }
                        ]
                    }
                ]
            });

            assignmentSubmissions.forEach(sub => {
                const assignment = sub.Assignment;
                if (!assignment) return;

                const score_obtained = parseFloat(sub.grade || 0);
                const score_total = parseFloat(assignment.max_score || 100);
                const score_percent = score_total > 0 ? Math.round((score_obtained / score_total) * 100) : 0;

                combinedSubmissions.push({
                    title: assignment.title,
                    subtitle: (assignment.Module && assignment.Module.name) || (assignment.Topic && assignment.Topic.name) || null,
                    type: 'assignment',
                    submission_date: sub.submitted_at ? this._formatDate(sub.submitted_at) : this._formatDate(sub.created_at),
                    raw_date: sub.submitted_at || sub.created_at,
                    score_obtained,
                    score_total,
                    score_percent
                });
            });
        }

        // Fetch Quizzes if type is 'all' or 'quiz'
        if (type === 'all' || type === 'quiz') {
            const quizSubmissions = await QuizSubmission.findAll({
                where: { enrollment_id: enrollment.id },
                include: [
                    {
                        model: Quiz,
                        include: [
                            { model: Module, as: 'module', attributes: ['name'] },
                            { model: Topic, as: 'topic', attributes: ['name'] }
                        ]
                    }
                ]
            });

            quizSubmissions.forEach(sub => {
                const quiz = sub.Quiz;
                if (!quiz) return;

                const score_obtained = parseFloat(sub.score || 0);
                const score_total = parseFloat(quiz.total_marks || 100);
                const score_percent = score_total > 0 ? Math.round((score_obtained / score_total) * 100) : 0;

                combinedSubmissions.push({
                    title: quiz.name,
                    subtitle: (quiz.module && quiz.module.name) || (quiz.topic && quiz.topic.name) || null,
                    type: 'quiz',
                    submission_date: sub.submitted_at ? this._formatDate(sub.submitted_at) : this._formatDate(sub.created_at),
                    raw_date: sub.submitted_at || sub.created_at,
                    score_obtained,
                    score_total,
                    score_percent
                });
            });
        }

        // Search Filter
        if (search) {
            const searchLower = search.toLowerCase();
            combinedSubmissions = combinedSubmissions.filter(sub => 
                sub.title.toLowerCase().includes(searchLower)
            );
        }

        // Sort by date descending
        combinedSubmissions.sort((a, b) => new Date(b.raw_date) - new Date(a.raw_date));

        // Pagination
        const total = combinedSubmissions.length;
        const offset = (page - 1) * limit;
        const paginatedSubmissions = combinedSubmissions.slice(offset, offset + limit);

        // Remove raw_date before returning
        const finalSubmissions = paginatedSubmissions.map(({ raw_date, ...rest }) => rest);

        return {
            submissions: finalSubmissions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    _formatDate(date) {
        const d = new Date(date);
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${months[d.getMonth()]} ${d.getDate().toString().padStart(2, '0')}, ${d.getFullYear()}`;
    }
}

module.exports = new BatchStudentsService();
