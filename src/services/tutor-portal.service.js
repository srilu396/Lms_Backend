const {
    Batch,
    Course,
    Enrollment,
    User,
    Module,
    Topic,
    Lesson,
    BatchPerformance,
    BatchTutor,
    Quiz,
    QuizSubmission,
    Assignment,
    BatchAssignment,
    AssignmentSubmission,
    Student
} = require('../models');
const { Op } = require('sequelize');

function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strTime = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    return `${month} ${day}, ${year} • ${strTime}`;
}

class TutorPortalService {

    // ─── 1. Stats API (Overview Cards) ──────────────────────────────────────────
    async getStatsData(tutorId) {
        // Total batches assigned to this tutor via batch_tutors junction table
        const totalAssignedBatches = await BatchTutor.count({
            where: { tutor_id: tutorId }
        });

        // Get all batch IDs for this tutor to count their students
        const tutorBatchRows = await BatchTutor.findAll({
            where: { tutor_id: tutorId },
            attributes: ['batch_id']
        });
        const tutorBatchIds = tutorBatchRows.map(row => row.batch_id);

        // Total students enrolled in those batches (active)
        const totalStudents = tutorBatchIds.length > 0
            ? await Enrollment.count({
                where: {
                    batch_id: { [Op.in]: tutorBatchIds },
                    status: 'active'
                }
            })
            : 0;

        // Placeholder — extend with Assignments / Session tables when ready
        const pendingEvaluations = 0;
        const todaySessions = 0;

        return {
            total_assigned_batches: totalAssignedBatches,
            total_students: totalStudents,
            pending_evaluations: pendingEvaluations,
            today_sessions: todaySessions
        };
    }

    // ─── 2. Dashboard API (Batches List) ────────────────────────────────────────
    async getDashboardData(tutorId, filters = {}) {
        const { page = 1, limit = 10, search = '', status } = filters;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        // Step 1: Resolve batch IDs assigned to this tutor via junction table
        const tutorBatchRows = await BatchTutor.findAll({
            where: { tutor_id: tutorId },
            attributes: ['batch_id']
        });
        const tutorBatchIds = tutorBatchRows.map(row => row.batch_id);

        if (tutorBatchIds.length === 0) {
            return {
                total_items: 0,
                total_pages: 0,
                current_page: parseInt(page, 10),
                items_per_page: parseInt(limit, 10),
                data: []
            };
        }

        // Step 2: Build where clause
        const whereClause = {
            id: { [Op.in]: tutorBatchIds }
        };

        if (status) {
            whereClause.status = status;
        }

        if (search) {
            whereClause.name = { [Op.iLike]: `%${search}%` };
        }

        // Step 3: Fetch paginated batches with related data
        const { count, rows: batches } = await Batch.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Course,
                    attributes: ['id', 'name']
                },
                {
                    model: BatchPerformance,
                    attributes: ['overall_progress', 'completion_rate'],
                    required: false
                }
            ],
            limit: parseInt(limit, 10),
            offset,
            order: [['created_at', 'DESC']],
            distinct: true
        });

        // Step 4: Enrich each batch with student count
        const batchData = await Promise.all(
            batches.map(async (batch) => {
                const studentCount = await Enrollment.count({
                    where: {
                        batch_id: batch.id,
                        status: 'active'
                    }
                });

                return {
                    id: batch.id,
                    batch_name: batch.name,
                    status: batch.status,
                    start_date: batch.start_date,
                    end_date: batch.end_date,
                    course: batch.Course
                        ? { id: batch.Course.id, name: batch.Course.name }
                        : null,
                    total_students: studentCount,
                    progress_percentage: batch.BatchPerformance
                        ? parseFloat(batch.BatchPerformance.overall_progress)
                        : 0,
                    completion_percentage: batch.BatchPerformance
                        ? parseFloat(batch.BatchPerformance.completion_rate)
                        : 0
                };
            })
        );

        return {
            total_items: count,
            total_pages: Math.ceil(count / parseInt(limit, 10)),
            current_page: parseInt(page, 10),
            items_per_page: parseInt(limit, 10),
            data: batchData
        };
    }

    // ─── 3. View Batch Course Structure ─────────────────────────────────────────
    async getBatchCourseStructure(batchId, tutorId, role) {
        // Verify the batch exists
        const batch = await Batch.findByPk(batchId, {
            include: [
                {
                    model: Course,
                    attributes: ['id', 'name', 'description']
                },
                {
                    model: BatchPerformance,
                    attributes: ['overall_progress'],
                    required: false
                }
            ]
        });

        if (!batch) {
            throw { statusCode: 404, message: 'Batch not found' };
        }

        // Authorization: tutors can only access their own assigned batches
        if (role !== 'admin') {
            const isAssigned = await BatchTutor.findOne({
                where: { batch_id: batchId, tutor_id: tutorId }
            });
            if (!isAssigned) {
                throw { statusCode: 403, message: 'Access denied. You are not assigned to this batch.' };
            }
        }

        if (!batch.course_id) {
            throw { statusCode: 404, message: 'No course is assigned to this batch yet.' };
        }

        // Fetch deep nested course structure
        const courseStructure = await Course.findByPk(batch.course_id, {
            attributes: ['id', 'name', 'description'],
            include: [
                {
                    model: Module,
                    as: 'modules',
                    attributes: ['id', 'name', 'order_num', 'description'],
                    include: [
                        {
                            model: Topic,
                            as: 'topics',
                            attributes: ['id', 'name', 'order_num'],
                            include: [
                                {
                                    model: Lesson,
                                    as: 'lessons',
                                    attributes: ['id', 'name', 'order_num', 'content_type', 'duration']
                                },
                                {
                                    model: Quiz,
                                    as: 'quizzes',
                                    attributes: ['id', 'title'],
                                    required: false
                                }
                            ],
                            order: [['order_num', 'ASC']]
                        }
                    ],
                    order: [['order_num', 'ASC']]
                }
            ]
        });

        return {
            batch_id: batch.id,
            batch_name: batch.name,
            batch_progress: batch.BatchPerformance
                ? parseFloat(batch.BatchPerformance.overall_progress)
                : 0,
            course_structure: courseStructure
        };
    }

    // ─── 4. Attendance Methods ──────────────────────────────────────────────────
    async getBatchAttendanceStats(tutorId, batchId, filters) {
        // Mock implementation to prevent 500 errors
        return { total: 0, present: 0, absent: 0, late: 0 };
    }

    async getBatchStudentsForAttendance(tutorId, batchId, filters) {
        return {
            total_items: 0,
            total_pages: 0,
            current_page: filters.page ? parseInt(filters.page) : 1,
            items_per_page: filters.limit ? parseInt(filters.limit) : 10,
            data: []
        };
    }

    async markBatchAttendance(tutorId, batchId, data) {
        return { success: true, message: "Attendance mock successful" };
    }

    // ─── 5. Quiz Methods ────────────────────────────────────────────────────────
    async getQuizStats(tutorId) {
        const tutorBatches = await BatchTutor.findAll({ where: { tutor_id: tutorId }, attributes: ['batch_id'] });
        const batchIds = tutorBatches.map(b => b.batch_id);

        if (batchIds.length === 0) return { total_quizzes: 0, pending_reviews: 0, average_score: 0 };

        const enrollments = await Enrollment.findAll({ where: { batch_id: { [Op.in]: batchIds } }, attributes: ['id'] });
        const enrollmentIds = enrollments.map(e => e.id);
        
        const total_quizzes = await Quiz.count(); // Simplified for overall scope
        const pending_reviews = await QuizSubmission.count({ where: { enrollment_id: { [Op.in]: enrollmentIds }, status: 'pending_review' } });
        
        const submissions = await QuizSubmission.findAll({ where: { enrollment_id: { [Op.in]: enrollmentIds }, status: 'completed' }, attributes: ['score'] });
        const average_score = submissions.length > 0 ? submissions.reduce((sum, s) => sum + Number(s.score), 0) / submissions.length : 0;

        return { total_quizzes, pending_reviews, average_score: Math.round(average_score) };
    }

    async getQuizzesOverview(tutorId, filters) {
        const { page = 1, limit = 10, search = '' } = filters;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        const tutorBatches = await BatchTutor.findAll({ where: { tutor_id: tutorId }, attributes: ['batch_id'] });
        const batchIds = tutorBatches.map(b => b.batch_id);

        if (batchIds.length === 0) {
            return { data: [], pagination: { total_items: 0, total_pages: 0, current_page: 1, items_per_page: limit } };
        }

        const whereClause = { id: { [Op.in]: batchIds } };
        if (search) {
             whereClause.name = { [Op.iLike]: `%${search}%` };
        }

        const { count, rows: batches } = await Batch.findAndCountAll({
             where: whereClause,
             include: [{ model: Course, attributes: ['id', 'name'] }],
             limit: parseInt(limit, 10),
             offset,
             order: [['created_at', 'DESC']]
        });

        const data = await Promise.all(batches.map(async (batch) => {
             const enrollments = await Enrollment.findAll({ where: { batch_id: batch.id, status: 'active' }, attributes: ['id'] });
             const enrollmentIds = enrollments.map(e => e.id);
             const totalStudents = enrollmentIds.length;

             let latestQuizName = 'N/A';
             let totalQuizzes = 0;

             if (batch.course_id) {
                 const modules = await Module.findAll({ where: { course_id: batch.course_id }, attributes: ['id'] });
                 const moduleIds = modules.map(m => m.id);
                 
                 const topics = await Topic.findAll({ where: { module_id: { [Op.in]: moduleIds } }, attributes: ['id'] });
                 const topicIds = topics.map(t => t.id);

                 const quizzes = await Quiz.findAll({
                     where: {
                         [Op.or]: [
                             { course_id: batch.course_id },
                             { module_id: { [Op.in]: moduleIds } },
                             { topic_id: { [Op.in]: topicIds } }
                         ]
                     },
                     order: [['created_at', 'DESC']]
                 });

                 totalQuizzes = quizzes.length;
                 if (totalQuizzes > 0) {
                     latestQuizName = quizzes[0].name;
                 }
             }

             const total_submissions = await QuizSubmission.count({ where: { enrollment_id: { [Op.in]: enrollmentIds } } });
             const possible_submissions = totalStudents * totalQuizzes;
             
             const completed_submissions = await QuizSubmission.findAll({ where: { enrollment_id: { [Op.in]: enrollmentIds }, status: 'completed' }, attributes: ['score'] });
             
             const submission_percentage = possible_submissions > 0 ? Math.round((total_submissions / possible_submissions) * 100) : 0;
             const average_score = completed_submissions.length > 0 
                 ? Math.round(completed_submissions.reduce((sum, s) => sum + Number(s.score), 0) / completed_submissions.length)
                 : 0;

             return {
                 batch_id: batch.id,
                 batch_name: batch.name,
                 course_name: batch.Course ? batch.Course.name : '',
                 latest_quiz: latestQuizName,
                 submissions_ratio: `${total_submissions}/${possible_submissions}`,
                 submission_percentage,
                 average_score
             };
        }));

        return {
            data,
            pagination: { 
                total_items: count, 
                total_pages: Math.ceil(count / limit), 
                current_page: parseInt(page), 
                items_per_page: parseInt(limit) 
            }
        };
    }

    async getBatchQuizStats(tutorId, batchId) {
        const enrollments = await Enrollment.findAll({ where: { batch_id: batchId }, attributes: ['id'] });
        const enrollmentIds = enrollments.map(e => e.id);
        
        const total_submissions = await QuizSubmission.count({ where: { enrollment_id: { [Op.in]: enrollmentIds } } });
        const completed_submissions = await QuizSubmission.count({ where: { enrollment_id: { [Op.in]: enrollmentIds }, status: 'completed' } });
        
        const completion_rate = total_submissions > 0 ? Math.round((completed_submissions / total_submissions) * 100) : 0;
        
        return { total_submissions, completed_submissions, completion_rate };
    }

    async getBatchStudentQuizzes(tutorId, batchId, filters) {
        const { page = 1, limit = 10, search = '', status } = filters;

        const studentWhere = {};
        if (search) {
            studentWhere[Op.or] = [
                { first_name: { [Op.iLike]: `%${search}%` } },
                { last_name: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const enrollments = await Enrollment.findAll({
            where: { batch_id: batchId, status: 'active' },
            include: [{
                model: Student,
                as: 'student',
                where: studentWhere
            }]
        });

        if (enrollments.length === 0) {
            return {
                data: [],
                pagination: { total_items: 0, total_pages: 0, current_page: parseInt(page), items_per_page: parseInt(limit) }
            };
        }

        const batch = await Batch.findByPk(batchId);
        if (!batch) {
            throw { statusCode: 404, message: 'Batch not found' };
        }

        let quizzes = [];
        if (batch.course_id) {
            const modules = await Module.findAll({ where: { course_id: batch.course_id }, attributes: ['id'] });
            const moduleIds = modules.map(m => m.id);
            const topics = await Topic.findAll({ where: { module_id: { [Op.in]: moduleIds } }, attributes: ['id'] });
            const topicIds = topics.map(t => t.id);

            quizzes = await Quiz.findAll({
                where: {
                    [Op.or]: [
                        { course_id: batch.course_id },
                        { module_id: { [Op.in]: moduleIds } },
                        { topic_id: { [Op.in]: topicIds } }
                    ]
                }
            });
        }

        const enrollmentIds = enrollments.map(e => e.id);
        const submissions = await QuizSubmission.findAll({
            where: { enrollment_id: { [Op.in]: enrollmentIds } }
        });

        const subMap = new Map();
        submissions.forEach(sub => {
            subMap.set(`${sub.enrollment_id}_${sub.quiz_id}`, sub);
        });

        const studentEmails = enrollments.map(e => e.student.email);
        const users = await User.findAll({
            where: { email: { [Op.in]: studentEmails } },
            attributes: ['id', 'email']
        });
        const userMap = new Map(users.map(u => [u.email, u.id]));

        const allPairs = [];
        for (const enrollment of enrollments) {
            for (const quiz of quizzes) {
                const sub = subMap.get(`${enrollment.id}_${quiz.id}`);
                const hasSubmitted = sub && (sub.status === 'completed' || sub.status === 'reviewed');
                const pairStatus = hasSubmitted ? 'GRADED' : 'PENDING';

                if (status && status !== 'All Status' && status.toUpperCase() !== pairStatus) {
                    continue;
                }

                const score = hasSubmitted ? `${Math.round(sub.score)}/${quiz.total_marks || 100}` : `--/${quiz.total_marks || 100}`;
                const rawSubDate = hasSubmitted ? sub.submitted_at || sub.created_at : (batch.end_date || new Date(quiz.created_at.getTime() + 7 * 24 * 60 * 60 * 1000));
                const submissionDate = formatDate(rawSubDate);
                const userId = userMap.get(enrollment.student.email) || null;

                allPairs.push({
                    student_id: userId ? Number(userId) : null,
                    quiz_id: quiz.id,
                    student_profile: enrollment.student.profile_image || null,
                    student_name: `${enrollment.student.first_name} ${enrollment.student.last_name}`,
                    student_email: enrollment.student.email,
                    quiz_title: quiz.name,
                    submission_date: submissionDate,
                    score,
                    status: pairStatus
                });
            }
        }

        const totalItems = allPairs.length;
        const parsedLimit = parseInt(limit, 10) || 10;
        const parsedPage = parseInt(page, 10) || 1;
        const startIndex = (parsedPage - 1) * parsedLimit;
        const paginatedData = allPairs.slice(startIndex, startIndex + parsedLimit);

        return {
            data: paginatedData,
            pagination: {
                total_items: totalItems,
                total_pages: Math.ceil(totalItems / parsedLimit),
                current_page: parsedPage,
                items_per_page: parsedLimit
            }
        };
    }

    async getQuizSubmissionReview(tutorId, quizId, studentId, batchId = null) {
        const { QuizQuestion, QuizAnswer } = require('../models');

        const submissionWhere = { quiz_id: quizId };
        if (batchId) {
            const user = await User.findByPk(studentId, { attributes: ['email'] });
            if (user) {
                const student = await Student.findOne({ where: { email: user.email }, attributes: ['id'] });
                if (student) {
                    const enrollment = await Enrollment.findOne({
                        where: { batch_id: batchId, student_id: student.id }
                    });
                    if (enrollment) {
                        submissionWhere.enrollment_id = enrollment.id;
                    } else {
                        submissionWhere.student_id = studentId;
                    }
                } else {
                    submissionWhere.student_id = studentId;
                }
            } else {
                submissionWhere.student_id = studentId;
            }
        } else {
            submissionWhere.student_id = studentId;
        }

        const submission = await QuizSubmission.findOne({
            where: submissionWhere,
            include: [
                { model: User, attributes: ['id', 'full_name', 'email'] },
                {
                    model: Quiz,
                    attributes: ['id', 'name', 'instructions', 'total_marks', 'passing_score']
                }
            ],
            order: [['attempt_number', 'DESC']]
        });

        if (!submission) {
            throw { statusCode: 404, message: 'Quiz submission not found' };
        }

        const answers = await QuizAnswer.findAll({
            where: { submission_id: submission.id },
            include: [{
                model: QuizQuestion
            }]
        });

        const totalQuestions = answers.length;
        const correctAnswers = answers.filter(a => a.is_correct).length;
        const totalMarks = submission.Quiz ? submission.Quiz.total_marks : 100;
        const passingScore = submission.Quiz ? submission.Quiz.passing_score : 50;
        const scoreObtained = submission.score;
        const gradeStatus = scoreObtained >= passingScore ? 'PASS' : 'FAIL';

        let timeTaken = '14m 22s';
        if (submission.submitted_at && submission.created_at) {
            const diffMs = new Date(submission.submitted_at) - new Date(submission.created_at);
            const diffMins = Math.floor(diffMs / 60000);
            const diffSecs = Math.floor((diffMs % 60000) / 1000);
            timeTaken = `${diffMins}m ${diffSecs}s`;
        }

        const formattedQuestions = answers.map((ans, index) => {
            const question = ans.QuizQuestion;
            return {
                number: index + 1,
                question_text: question ? question.question_text : '',
                type: question ? question.type : 'mcq',
                options: question ? question.options : [],
                correct_answer: question ? question.correct_answer : '',
                student_choice: ans.selected_answer,
                is_correct: ans.is_correct,
                marks: question ? question.marks : 1
            };
        });

        const student = await Student.findOne({ where: { email: submission.User.email }, attributes: ['profile_image'] });

        return {
            student: {
                name: submission.User.full_name,
                email: submission.User.email,
                profile_image: student ? student.profile_image : null
            },
            quiz: {
                title: submission.Quiz.name,
                total_marks: totalMarks
            },
            summary: {
                score: `${Math.round(scoreObtained)}/${totalMarks}`,
                time_taken: timeTaken,
                correct_answers: `${correctAnswers}/${totalQuestions}`,
                final_grade: gradeStatus,
                submitted_at: formatDate(submission.submitted_at || submission.created_at)
            },
            questions: formattedQuestions
        };
    }

    // ─── 6. Assignment Methods ──────────────────────────────────────────────────
    async getAssignmentStats(tutorId) {
        const tutorBatches = await BatchTutor.findAll({ where: { tutor_id: tutorId }, attributes: ['batch_id'] });
        const batchIds = tutorBatches.map(b => b.batch_id);

        if (batchIds.length === 0) return { total_assignments: 0, pending_grading: 0 };

        const batchAssignments = await BatchAssignment.findAll({ where: { batch_id: { [Op.in]: batchIds } }, attributes: ['assignment_id'] });
        const total_assignments = batchAssignments.length;

        const enrollments = await Enrollment.findAll({ where: { batch_id: { [Op.in]: batchIds } }, attributes: ['id'] });
        const enrollmentIds = enrollments.map(e => e.id);
        
        const pending_grading = await AssignmentSubmission.count({ where: { enrollment_id: { [Op.in]: enrollmentIds }, status: 'submitted' } });

        return { total_assignments, pending_grading };
    }

    async getAssignmentsOverview(tutorId, filters) {
        const { page = 1, limit = 10, search = '' } = filters;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        const tutorBatches = await BatchTutor.findAll({ where: { tutor_id: tutorId }, attributes: ['batch_id'] });
        const batchIds = tutorBatches.map(b => b.batch_id);

        if (batchIds.length === 0) {
            return { data: [], pagination: { total_items: 0, total_pages: 0, current_page: 1, items_per_page: limit } };
        }

        const whereClause = { id: { [Op.in]: batchIds } };
        if (search) {
             whereClause.name = { [Op.iLike]: `%${search}%` };
        }

        const { count, rows: batches } = await Batch.findAndCountAll({
             where: whereClause,
             include: [{ model: Course, attributes: ['id', 'name'] }],
             limit: parseInt(limit, 10),
             offset,
             order: [['created_at', 'DESC']]
        });

        const data = await Promise.all(batches.map(async (batch) => {
             const enrollments = await Enrollment.findAll({ where: { batch_id: batch.id, status: 'active' }, attributes: ['id'] });
             const enrollmentIds = enrollments.map(e => e.id);
             const totalStudents = enrollmentIds.length;

             const batchAssignments = await BatchAssignment.findAll({ 
                 where: { batch_id: batch.id }, 
                 attributes: ['assignment_id'],
                 include: [{ model: Assignment, attributes: ['title', 'created_at'] }],
                 order: [[Assignment, 'created_at', 'DESC']]
             });
             
             const totalAssignments = batchAssignments.length;
             const latestAssignmentName = totalAssignments > 0 && batchAssignments[0].Assignment ? batchAssignments[0].Assignment.title : 'N/A';

             const total_submissions = await AssignmentSubmission.count({ where: { enrollment_id: { [Op.in]: enrollmentIds } } });
             const possible_submissions = totalStudents * totalAssignments;
             
             const graded_submissions = await AssignmentSubmission.findAll({ where: { enrollment_id: { [Op.in]: enrollmentIds }, status: 'graded' }, attributes: ['grade'] });
             
             const submission_percentage = possible_submissions > 0 ? Math.round((total_submissions / possible_submissions) * 100) : 0;
             const average_score = graded_submissions.length > 0 
                 ? Math.round(graded_submissions.reduce((sum, s) => sum + Number(s.grade), 0) / graded_submissions.length)
                 : 0;

             return {
                 batch_id: batch.id,
                 batch_name: batch.name,
                 course_name: batch.Course ? batch.Course.name : '',
                 latest_assignment: latestAssignmentName,
                 submissions_ratio: `${total_submissions}/${possible_submissions}`,
                 submission_percentage,
                 average_score
             };
        }));

        return {
            data,
            pagination: { 
                total_items: count, 
                total_pages: Math.ceil(count / limit), 
                current_page: parseInt(page), 
                items_per_page: parseInt(limit) 
            }
        };
    }

    async getBatchAssignmentStats(tutorId, batchId) {
        const batchAssignments = await BatchAssignment.count({ where: { batch_id: batchId } });
        
        const enrollments = await Enrollment.findAll({ where: { batch_id: batchId }, attributes: ['id'] });
        const enrollmentIds = enrollments.map(e => e.id);
        
        const total_submissions = await AssignmentSubmission.count({ where: { enrollment_id: { [Op.in]: enrollmentIds } } });
        const possible_submissions = enrollments.length * batchAssignments;
        
        const submission_rate = possible_submissions > 0 ? Math.round((total_submissions / possible_submissions) * 100) : 0;

        return { total_assignments: batchAssignments, total_submissions, submission_rate };
    }

    async getBatchStudentAssignments(tutorId, batchId, filters) {
        const { page = 1, limit = 10, search = '', status } = filters;

        const studentWhere = {};
        if (search) {
            studentWhere[Op.or] = [
                { first_name: { [Op.iLike]: `%${search}%` } },
                { last_name: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const enrollments = await Enrollment.findAll({
            where: { batch_id: batchId, status: 'active' },
            include: [{
                model: Student,
                as: 'student',
                where: studentWhere
            }]
        });

        if (enrollments.length === 0) {
            return {
                data: [],
                pagination: { total_items: 0, total_pages: 0, current_page: parseInt(page), items_per_page: parseInt(limit) }
            };
        }

        const batch = await Batch.findByPk(batchId);
        if (!batch) {
            throw { statusCode: 404, message: 'Batch not found' };
        }

        const batchAssignments = await BatchAssignment.findAll({
            where: { batch_id: batchId },
            include: [{ model: Assignment }]
        });
        const assignments = batchAssignments.map(ba => ba.Assignment).filter(Boolean);

        const enrollmentIds = enrollments.map(e => e.id);
        const submissions = await AssignmentSubmission.findAll({
            where: { enrollment_id: { [Op.in]: enrollmentIds } }
        });

        const subMap = new Map();
        submissions.forEach(sub => {
            subMap.set(`${sub.enrollment_id}_${sub.assignment_id}`, sub);
        });

        const studentEmails = enrollments.map(e => e.student.email);
        const users = await User.findAll({
            where: { email: { [Op.in]: studentEmails } },
            attributes: ['id', 'email']
        });
        const userMap = new Map(users.map(u => [u.email, u.id]));

        const allPairs = [];
        for (const enrollment of enrollments) {
            for (const assignment of assignments) {
                const sub = subMap.get(`${enrollment.id}_${assignment.id}`);
                const isGraded = sub && sub.status === 'graded';
                const pairStatus = isGraded ? 'GRADED' : 'PENDING';

                if (status && status !== 'All Status' && status.toUpperCase() !== pairStatus) {
                    continue;
                }

                const score = isGraded ? `${Math.round(sub.grade)}/${assignment.max_score || 100}` : `--/${assignment.max_score || 100}`;
                const baMapping = batchAssignments.find(ba => ba.assignment_id === assignment.id);
                const dueDate = baMapping ? baMapping.due_date : null;
                const rawSubDate = sub ? sub.submitted_at || sub.created_at : (dueDate || batch.end_date || new Date());
                const submissionDate = formatDate(rawSubDate);
                const userId = userMap.get(enrollment.student.email) || null;

                allPairs.push({
                    student_id: userId ? Number(userId) : null,
                    assignment_id: assignment.id,
                    student_profile: enrollment.student.profile_image || null,
                    student_name: `${enrollment.student.first_name} ${enrollment.student.last_name}`,
                    student_email: enrollment.student.email,
                    assignment_title: assignment.title,
                    submission_date: submissionDate,
                    score,
                    status: pairStatus
                });
            }
        }

        const totalItems = allPairs.length;
        const parsedLimit = parseInt(limit, 10) || 10;
        const parsedPage = parseInt(page, 10) || 1;
        const startIndex = (parsedPage - 1) * parsedLimit;
        const paginatedData = allPairs.slice(startIndex, startIndex + parsedLimit);

        return {
            data: paginatedData,
            pagination: {
                total_items: totalItems,
                total_pages: Math.ceil(totalItems / parsedLimit),
                current_page: parsedPage,
                items_per_page: parsedLimit
            }
        };
    }
}

module.exports = new TutorPortalService();
