const {
    Batch,
    Course,
    Domain,
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
    AssignmentCriteria,
    BatchAssignment,
    AssignmentSubmission,
    Student,
    Tutor,
    sequelize
} = require('../models');
const { Op } = require('sequelize');
const { mediaInclude, serializeWithMedia } = require('../utils/media');

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

    async checkBatchAllocation(tutorId, batchId) {
        const isAssigned = await BatchTutor.findOne({
            where: { batch_id: batchId, tutor_id: tutorId }
        });
        if (!isAssigned) {
            throw { statusCode: 403, message: 'Access denied. You are not assigned to this batch.' };
        }
    }

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
                    model: Domain,
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
        const batchIds = batches.map(b => b.id);
        const studentCounts = batchIds.length > 0
            ? await Enrollment.findAll({
                where: {
                    batch_id: { [Op.in]: batchIds },
                    status: 'active'
                },
                attributes: [
                    'batch_id',
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count']
                ],
                group: ['batch_id'],
                raw: true
            })
            : [];

        const studentCountMap = {};
        studentCounts.forEach(c => {
            studentCountMap[c.batch_id] = parseInt(c.count, 10);
        });

        const batchData = batches.map((batch) => {
            const studentCount = studentCountMap[batch.id] || 0;

            let type = null;
            let course = null;
            let domain = null;
            
            if (batch.course_id) {
                type = 'course';
                course = batch.Course ? { id: batch.Course.id, name: batch.Course.name } : null;
            } else if (batch.domain_id) {
                type = 'domain';
                domain = batch.Domain ? { id: batch.Domain.id, name: batch.Domain.name } : null;
            }

            return {
                id: batch.id,
                batch_name: batch.name,
                status: batch.status,
                start_date: batch.start_date,
                end_date: batch.end_date,
                type,
                course,
                domain,
                total_students: studentCount,
                progress_percentage: batch.BatchPerformance
                    ? parseFloat(batch.BatchPerformance.overall_progress)
                    : 0,
                completion_percentage: batch.BatchPerformance
                    ? parseFloat(batch.BatchPerformance.completion_rate)
                    : 0
            };
        });

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
                    attributes: ['id', 'name', 'order_num', 'description', 'image_url', 'video_url', 'pdf_url', 'url'],
                    include: [
                        mediaInclude(),
                        {
                            model: Lesson,
                            as: 'lessons',
                            attributes: ['id', 'name', 'order_num', 'type', 'duration_minutes', 'content_text', 'image_url', 'video_url', 'url', 'pdf_url'],
                            include: [
                                mediaInclude(),
                                {
                                    model: Topic,
                                    as: 'topics',
                                    attributes: ['id', 'name', 'order_num', 'description', 'content_text', 'text', 'image_url', 'video_url', 'url', 'pdf_url'],
                                    include: [mediaInclude()]
                                },
                                {
                                    model: Quiz,
                                    as: 'quizzes',
                                    attributes: ['id', 'name'],
                                    required: false
                                },
                                {
                                    model: Assignment,
                                    as: 'assignments',
                                    attributes: ['id', 'title'],
                                    required: false
                                }
                            ]
                        },
                        {
                            model: Quiz,
                            as: 'quizzes',
                            attributes: ['id', 'name'],
                            required: false
                        },
                        {
                            model: Assignment,
                            as: 'assignments',
                            attributes: ['id', 'title'],
                            required: false
                        }
                    ]
                }
            ],
            order: [
                [{ model: Module, as: 'modules' }, 'order_num', 'ASC'],
                [{ model: Module, as: 'modules' }, { model: Lesson, as: 'lessons' }, 'order_num', 'ASC'],
                [{ model: Module, as: 'modules' }, { model: Lesson, as: 'lessons' }, { model: Topic, as: 'topics' }, 'order_num', 'ASC']
            ]
        });

        // Serialize course structure with grouped media arrays
        const courseJson = courseStructure ? courseStructure.toJSON() : null;
        if (courseJson && courseJson.modules) {
            courseJson.modules = courseJson.modules.map(m => {
                const mod = serializeWithMedia(m);
                if (mod.lessons) {
                    mod.lessons = mod.lessons.map(l => {
                        const les = serializeWithMedia(l);
                        if (les.topics) les.topics = les.topics.map(t => serializeWithMedia(t));
                        return les;
                    });
                }
                return mod;
            });
        }

        return {
            batch_id: batch.id,
            batch_name: batch.name,
            batch_progress: batch.BatchPerformance
                ? parseFloat(batch.BatchPerformance.overall_progress)
                : 0,
            course_structure: courseJson
        };
    }

    // ─── 4. Attendance Methods ──────────────────────────────────────────────────
    async getBatchAttendanceStats(tutorId, batchId, filters) {
        await this.checkBatchAllocation(tutorId, batchId);
        // Mock implementation to prevent 500 errors
        return { total: 0, present: 0, absent: 0, late: 0 };
    }

    async getBatchStudentsForAttendance(tutorId, batchId, filters) {
        await this.checkBatchAllocation(tutorId, batchId);
        return {
            total_items: 0,
            total_pages: 0,
            current_page: filters.page ? parseInt(filters.page) : 1,
            items_per_page: filters.limit ? parseInt(filters.limit) : 10,
            data: []
        };
    }

    async markBatchAttendance(tutorId, batchId, data) {
        await this.checkBatchAllocation(tutorId, batchId);
        return { success: true, message: "Attendance mock successful" };
    }

    // ─── 5. Quiz Methods ────────────────────────────────────────────────────────
    async getQuizStats(tutorId) {
        const tutorBatches = await BatchTutor.findAll({ where: { tutor_id: tutorId }, attributes: ['batch_id'] });
        const batchIds = tutorBatches.map(b => b.batch_id);

        if (batchIds.length === 0) {
            return {
                total_quizzes: 0,
                pending_reviews: 0,
                average_score: 0,
                total_batches: 0,
                total_submissions: 0
            };
        }

        const batches = await Batch.findAll({ where: { id: { [Op.in]: batchIds } }, attributes: ['course_id'] });
        const courseIds = batches.map(b => b.course_id).filter(Boolean);

        let total_quizzes = 0;
        if (courseIds.length > 0) {
            const modules = await Module.findAll({ where: { course_id: { [Op.in]: courseIds } }, attributes: ['id'] });
            const moduleIds = modules.map(m => m.id);
            
            const lessons = moduleIds.length > 0 ? await Lesson.findAll({ where: { module_id: { [Op.in]: moduleIds } }, attributes: ['id'] }) : [];
            const lessonIds = lessons.map(l => l.id);

            const quizWhere = {
                [Op.or]: [
                    { course_id: { [Op.in]: courseIds } }
                ]
            };
            if (moduleIds.length > 0) {
                quizWhere[Op.or].push({ module_id: { [Op.in]: moduleIds } });
            }
            if (lessonIds.length > 0) {
                quizWhere[Op.or].push({ lesson_id: { [Op.in]: lessonIds } });
            }

            total_quizzes = await Quiz.count({ where: quizWhere });
        }

        const enrollments = await Enrollment.findAll({ where: { batch_id: { [Op.in]: batchIds } }, attributes: ['id'] });
        const enrollmentIds = enrollments.map(e => e.id);
        
        const pending_reviews = await QuizSubmission.count({ where: { enrollment_id: { [Op.in]: enrollmentIds }, status: 'pending_review' } });
        
        const submissions = await QuizSubmission.findAll({ where: { enrollment_id: { [Op.in]: enrollmentIds }, status: 'completed' }, attributes: ['score'] });
        const average_score = submissions.length > 0 ? submissions.reduce((sum, s) => sum + Number(s.score), 0) / submissions.length : 0;

        const total_submissions = await QuizSubmission.count({ where: { enrollment_id: { [Op.in]: enrollmentIds } } });

        return {
            total_quizzes,
            pending_reviews,
            average_score: Math.round(average_score),
            total_batches: batchIds.length,
            total_submissions
        };
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
                 
                 const lessons = moduleIds.length > 0 ? await Lesson.findAll({ where: { module_id: { [Op.in]: moduleIds } }, attributes: ['id'] }) : [];
                 const lessonIds = lessons.map(l => l.id);

                 const quizzes = await Quiz.findAll({
                     where: {
                         [Op.or]: [
                             { course_id: batch.course_id },
                             { module_id: { [Op.in]: moduleIds } },
                             { lesson_id: { [Op.in]: lessonIds } }
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
        await this.checkBatchAllocation(tutorId, batchId);
        const enrollments = await Enrollment.findAll({ where: { batch_id: batchId }, attributes: ['id'] });
        const enrollmentIds = enrollments.map(e => e.id);
        
        const total_submissions = await QuizSubmission.count({ where: { enrollment_id: { [Op.in]: enrollmentIds } } });
        const completed_submissions = await QuizSubmission.count({ where: { enrollment_id: { [Op.in]: enrollmentIds }, status: 'completed' } });
        
        const completion_rate = total_submissions > 0 ? Math.round((completed_submissions / total_submissions) * 100) : 0;
        
        return { total_submissions, completed_submissions, completion_rate };
    }

    async getBatchStudentQuizzes(tutorId, batchId, filters) {
        await this.checkBatchAllocation(tutorId, batchId);
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
            const lessons = moduleIds.length > 0 ? await Lesson.findAll({ where: { module_id: { [Op.in]: moduleIds } }, attributes: ['id'] }) : [];
            const lessonIds = lessons.map(l => l.id);

            quizzes = await Quiz.findAll({
                where: {
                    [Op.or]: [
                        { course_id: batch.course_id },
                        { module_id: { [Op.in]: moduleIds } },
                        { lesson_id: { [Op.in]: lessonIds } }
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
            await this.checkBatchAllocation(tutorId, batchId);

            const user = await User.findByPk(studentId, { attributes: ['email'] });
            if (!user) {
                throw { statusCode: 404, message: 'Student user not found' };
            }
            const student = await Student.findOne({ where: { email: user.email }, attributes: ['id'] });
            if (!student) {
                throw { statusCode: 404, message: 'Student profile not found' };
            }
            const enrollment = await Enrollment.findOne({
                where: { batch_id: batchId, student_id: student.id }
            });
            if (!enrollment) {
                throw { statusCode: 403, message: 'Access denied. Student is not enrolled in this batch.' };
            }
            submissionWhere.enrollment_id = enrollment.id;
        } else {
            const tutorBatches = await BatchTutor.findAll({ where: { tutor_id: tutorId }, attributes: ['batch_id'] });
            const batchIds = tutorBatches.map(b => b.batch_id);
            if (batchIds.length === 0) {
                throw { statusCode: 403, message: 'Access denied. You have no assigned batches.' };
            }

            const user = await User.findByPk(studentId, { attributes: ['email'] });
            if (!user) {
                throw { statusCode: 404, message: 'Student user not found' };
            }
            const student = await Student.findOne({ where: { email: user.email }, attributes: ['id'] });
            if (!student) {
                throw { statusCode: 404, message: 'Student profile not found' };
            }
            const enrollment = await Enrollment.findOne({
                where: {
                    batch_id: { [Op.in]: batchIds },
                    student_id: student.id
                }
            });
            if (!enrollment) {
                throw { statusCode: 403, message: 'Access denied. Student is not enrolled in any of your batches.' };
            }
            submissionWhere.enrollment_id = enrollment.id;
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
                marks: question ? question.marks : 1,
                explanation: question ? (question.explanation || null) : null
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

    // ─── 0. Profile ─────────────────────────────────────────────────────────────
    async getProfile(tutorId) {
        const tutor = await Tutor.findByPk(tutorId, {
            attributes: { exclude: ['password'] },
            include: [{
                model: Batch,
                as: 'batches',
                attributes: ['id', 'name', 'start_date', 'end_date'],
                through: { attributes: [] }
            }]
        });
        
        if (!tutor) {
            throw { statusCode: 404, message: 'Tutor profile not found' };
        }
        
        const profileData = tutor.toJSON();
        profileData.allocated_batches = profileData.batches || [];
        delete profileData.batches;
        
        return profileData;
    }

    async updateProfile(tutorId, userId, updateData) {
        const tutor = await Tutor.findByPk(tutorId);
        const user = await User.findByPk(userId);

        if (!tutor || !user) {
            throw { statusCode: 404, message: 'Tutor or User not found' };
        }

        // Fields allowed to be updated in Tutor model
        const tutorFields = ['full_name', 'mobile_number', 'profile_image', 'tags', 'domains'];
        const tutorUpdate = {};
        tutorFields.forEach(field => {
            if (updateData[field] !== undefined) {
                tutorUpdate[field] = updateData[field];
            }
        });

        // Update Tutor
        if (Object.keys(tutorUpdate).length > 0) {
            await tutor.update(tutorUpdate);
        }

        // Sync with User model if necessary
        const userUpdate = {};
        if (updateData.full_name) {
            userUpdate.full_name = updateData.full_name;
        }
        
        // If email update is provided, sync it
        if (updateData.email && updateData.email !== user.email) {
            const emailInUse = await User.findOne({ where: { email: updateData.email, id: { [Op.ne]: userId } } });
            if (emailInUse) {
                throw { statusCode: 400, message: 'Email already in use' };
            }
            userUpdate.email = updateData.email;
            await tutor.update({ email: updateData.email });
        }

        if (Object.keys(userUpdate).length > 0) {
            await user.update(userUpdate);
        }

        return await this.getProfile(tutorId);
    }

    // ─── 6. Assignment Methods ──────────────────────────────────────────────────
    async getAssignmentStats(tutorId) {
        const tutorBatches = await BatchTutor.findAll({ where: { tutor_id: tutorId }, attributes: ['batch_id'] });
        const batchIds = tutorBatches.map(b => b.batch_id);

        if (batchIds.length === 0) {
            return {
                total_assignments: 0,
                pending_grading: 0,
                total_batches: 0,
                total_submissions: 0
            };
        }

        const batchAssignments = await BatchAssignment.findAll({ where: { batch_id: { [Op.in]: batchIds } }, attributes: ['assignment_id'] });
        const total_assignments = batchAssignments.length;

        const enrollments = await Enrollment.findAll({ where: { batch_id: { [Op.in]: batchIds } }, attributes: ['id'] });
        const enrollmentIds = enrollments.map(e => e.id);
        
        const pending_grading = await AssignmentSubmission.count({ where: { enrollment_id: { [Op.in]: enrollmentIds }, status: 'submitted' } });
        const total_submissions = await AssignmentSubmission.count({
            where: {
                enrollment_id: { [Op.in]: enrollmentIds },
                status: { [Op.ne]: 'pending' }
            }
        });

        return {
            total_assignments,
            pending_grading,
            total_batches: batchIds.length,
            total_submissions
        };
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

             const total_submissions = await AssignmentSubmission.count({
                 where: {
                     enrollment_id: { [Op.in]: enrollmentIds },
                     status: { [Op.ne]: 'pending' }
                 }
             });
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
        await this.checkBatchAllocation(tutorId, batchId);
        const batchAssignments = await BatchAssignment.count({ where: { batch_id: batchId } });
        
        const enrollments = await Enrollment.findAll({ where: { batch_id: batchId }, attributes: ['id'] });
        const enrollmentIds = enrollments.map(e => e.id);
        
        const total_submissions = await AssignmentSubmission.count({
            where: {
                enrollment_id: { [Op.in]: enrollmentIds },
                status: { [Op.ne]: 'pending' }
            }
        });
        const possible_submissions = enrollments.length * batchAssignments;
        
        const submission_rate = possible_submissions > 0 ? Math.round((total_submissions / possible_submissions) * 100) : 0;

        return { total_assignments: batchAssignments, total_submissions, submission_rate };
    }

    async getBatchStudentAssignments(tutorId, batchId, filters) {
        await this.checkBatchAllocation(tutorId, batchId);
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

    async getAssignmentSubmissionReview(tutorId, assignmentId, studentId, batchId = null) {
        // 1. Resolve student enrollment and verify batch allocation
        const studentUser = await User.findByPk(studentId);
        if (!studentUser) {
            throw { statusCode: 404, message: 'Student user not found' };
        }
        const studentProfile = await Student.findOne({ where: { email: studentUser.email } });
        if (!studentProfile) {
            throw { statusCode: 404, message: 'Student profile not found' };
        }

        let enrollment;
        if (batchId) {
            await this.checkBatchAllocation(tutorId, batchId);
            enrollment = await Enrollment.findOne({
                where: { student_id: studentProfile.id, batch_id: batchId, status: 'active' }
            });
            if (!enrollment) {
                throw { statusCode: 404, message: 'Active enrollment not found for this student in the specified batch.' };
            }
        } else {
            // Find student's active enrollment for this assignment's course
            const assignment = await Assignment.findByPk(assignmentId);
            if (!assignment) {
                throw { statusCode: 404, message: 'Assignment not found' };
            }
            enrollment = await Enrollment.findOne({
                where: { student_id: studentProfile.id, status: 'active' },
                include: [{
                    model: Batch,
                    where: { course_id: assignment.course_id },
                    required: true
                }]
            });
            if (!enrollment) {
                throw { statusCode: 404, message: 'Active enrollment not found for this student' };
            }
            await this.checkBatchAllocation(tutorId, enrollment.batch_id);
        }

        // 2. Fetch the assignment details and its evaluation matrix (criteria)
        const assignment = await Assignment.findByPk(assignmentId, {
            include: [{
                model: AssignmentCriteria,
                as: 'evaluation_matrix',
                attributes: ['id', 'criteria_name', 'max_points', 'description']
            }]
        });

        if (!assignment) {
            throw { statusCode: 404, message: 'Assignment not found' };
        }

        // 3. Find the student's submission
        const submission = await AssignmentSubmission.findOne({
            where: {
                student_id: studentId,
                assignment_id: assignmentId,
                enrollment_id: enrollment.id
            },
            include: [{
                model: User,
                attributes: ['id', 'full_name', 'email']
            }]
        });

        if (!submission) {
            throw { statusCode: 404, message: 'Assignment submission not found' };
        }

        // 4. Retrieve tutor draft evaluation or tutor finalized evaluation from submission_data
        const submissionData = submission.submission_data || {};
        const draftEvaluation = submissionData.tutor_draft_evaluation || null;
        const finalEvaluation = submissionData.tutor_evaluation || null;

        // Check if there is an active evaluation (prioritize draft if it's currently submitted/pending review, or show whatever is saved)
        const activeEval = draftEvaluation || finalEvaluation;

        // Build mapping of criteria_id -> obtained score
        const ratingsMap = {};
        if (activeEval && Array.isArray(activeEval.criteria_ratings)) {
            activeEval.criteria_ratings.forEach(rating => {
                ratingsMap[rating.criteria_id] = rating.score;
            });
        }

        // Merging evaluation criteria with obtained points
        const mergedCriteria = (assignment.evaluation_matrix || []).map(crit => {
            return {
                criteria_id: crit.id,
                criteria_name: crit.criteria_name,
                max_points: parseFloat(crit.max_points),
                description: crit.description,
                obtained_points: ratingsMap[crit.id] !== undefined ? parseFloat(ratingsMap[crit.id]) : null
            };
        });

        // Parse student submitted content
        let submittedContent = submissionData.submissionContent || null;
        let uploadedFiles = submissionData.attachments || [];
        if (uploadedFiles.length === 0 && submission.file_url) {
            uploadedFiles.push({
                fileName: submission.file_url.split('/').pop() || 'uploaded_file',
                fileUrl: submission.file_url,
                fileType: 'unknown'
            });
        }

        const obtainedGrade = submission.grade ? parseFloat(submission.grade) : null;
        const totalMarks = assignment.max_score ? parseFloat(assignment.max_score) : 100;
        const passMarks = totalMarks * 0.4;
        const activeFeedback = submission.feedback || (draftEvaluation ? draftEvaluation.feedback : null);

        return {
            submissionId: submission.id,
            assignmentId: String(assignment.id),
            studentId: String(studentId),
            studentName: submission.User ? submission.User.full_name : 'N/A',
            studentEmail: submission.User ? submission.User.email : 'N/A',
            assignmentTitle: assignment.title,
            isDraft: !!draftEvaluation,
            evaluationMatrix: mergedCriteria,
            result: {
                obtainedMarks: obtainedGrade,
                totalMarks: totalMarks,
                passMarks: passMarks,
                status: submission.status,
                submittedAt: submission.submitted_at || submission.created_at,
                feedback: activeFeedback ? {
                    reviewedBy: "Tutor",
                    comments: activeFeedback,
                    tags: []
                } : null,
                submittedContent: submittedContent,
                submittedFiles: uploadedFiles,
                socialLinks: submissionData.socialLinks || [],
                githubLinks: submissionData.githubLinks || []
            }
        };
    }

    async evaluateAssignmentSubmission(tutorId, assignmentId, studentId, batchId = null, evaluationData) {
        // 1. Resolve student enrollment and verify batch allocation
        const studentUser = await User.findByPk(studentId);
        if (!studentUser) {
            throw { statusCode: 404, message: 'Student user not found' };
        }
        const studentProfile = await Student.findOne({ where: { email: studentUser.email } });
        if (!studentProfile) {
            throw { statusCode: 404, message: 'Student profile not found' };
        }

        let enrollment;
        if (batchId) {
            await this.checkBatchAllocation(tutorId, batchId);
            enrollment = await Enrollment.findOne({
                where: { student_id: studentProfile.id, batch_id: batchId, status: 'active' }
            });
            if (!enrollment) {
                throw { statusCode: 404, message: 'Active enrollment not found for this student in the specified batch.' };
            }
        } else {
            // Find student's active enrollment for this assignment's course
            const assignment = await Assignment.findByPk(assignmentId);
            if (!assignment) {
                throw { statusCode: 404, message: 'Assignment not found' };
            }
            enrollment = await Enrollment.findOne({
                where: { student_id: studentProfile.id, status: 'active' },
                include: [{
                    model: Batch,
                    where: { course_id: assignment.course_id },
                    required: true
                }]
            });
            if (!enrollment) {
                throw { statusCode: 404, message: 'Active enrollment not found for this student' };
            }
            await this.checkBatchAllocation(tutorId, enrollment.batch_id);
        }

        // 2. Fetch the assignment details and criteria
        const assignment = await Assignment.findByPk(assignmentId, {
            include: [{
                model: AssignmentCriteria,
                as: 'evaluation_matrix',
                attributes: ['id', 'criteria_name', 'max_points', 'description']
            }]
        });

        if (!assignment) {
            throw { statusCode: 404, message: 'Assignment not found' };
        }

        // 3. Find the student's submission
        const submission = await AssignmentSubmission.findOne({
            where: {
                student_id: studentId,
                assignment_id: assignmentId,
                enrollment_id: enrollment.id
            }
        });

        if (!submission) {
            throw { statusCode: 404, message: 'Assignment submission not found' };
        }

        const { is_draft = false, feedback = '', criteria_ratings = [], status = 'graded', marks, score, grade } = evaluationData;
        
        // Accept direct score if provided
        const directScore = marks !== undefined ? marks : (score !== undefined ? score : (grade !== undefined ? grade : null));

        // 4. Validate criteria ratings against assignment criteria max points
        const criteriaMap = {};
        (assignment.evaluation_matrix || []).forEach(crit => {
            criteriaMap[crit.id] = parseFloat(crit.max_points);
        });

        if (criteria_ratings && Array.isArray(criteria_ratings)) {
            for (const rating of criteria_ratings) {
                const maxPts = criteriaMap[rating.criteria_id];
                if (maxPts === undefined) {
                    throw { statusCode: 400, message: `Invalid criteria ID: ${rating.criteria_id} for this assignment.` };
                }
                const ratingScore = parseFloat(rating.score);
                if (isNaN(ratingScore) || ratingScore < 0 || ratingScore > maxPts) {
                    throw { statusCode: 400, message: `Score for criteria "${rating.criteria_id}" must be between 0 and the max points (${maxPts}).` };
                }
            }
        }

        // 5. Update submission record based on is_draft
        const submissionData = JSON.parse(JSON.stringify(submission.submission_data || {}));

        if (is_draft) {
            // Save as draft evaluation
            submissionData.tutor_draft_evaluation = {
                feedback,
                criteria_ratings,
                direct_score: directScore,
                updated_at: new Date()
            };
            
            submission.submission_data = submissionData;
            submission.changed('submission_data', true);
            await submission.save();
        } else {
            // Publishing evaluation
            if (status === 'resubmit_requested') {
                submissionData.tutor_evaluation = {
                    feedback,
                    criteria_ratings,
                    direct_score: directScore,
                    graded_at: new Date()
                };
                delete submissionData.tutor_draft_evaluation;

                submission.submission_data = submissionData;
                submission.status = 'resubmit_requested';
                submission.grade = null;
                submission.feedback = feedback || 'Resubmission requested by tutor.';
                submission.changed('submission_data', true);
                await submission.save();
            } else {
                // status is 'graded'
                // Compute total score as sum of criteria ratings
                let totalGrade = 0;
                if (criteria_ratings && criteria_ratings.length > 0) {
                    totalGrade = criteria_ratings.reduce((sum, rating) => sum + parseFloat(rating.score), 0);
                } else if (directScore !== null) {
                    totalGrade = parseFloat(directScore);
                } else {
                    // Fallback to average/default if no ratings provided
                    totalGrade = parseFloat(assignment.max_score);
                }

                submissionData.tutor_evaluation = {
                    feedback,
                    criteria_ratings,
                    graded_at: new Date()
                };
                delete submissionData.tutor_draft_evaluation;

                submission.submission_data = submissionData;
                submission.status = 'graded';
                submission.grade = totalGrade;
                submission.feedback = feedback || '';
                submission.graded_at = new Date();
                submission.changed('submission_data', true);
                await submission.save();
            }
        }

        return await this.getAssignmentSubmissionReview(tutorId, assignmentId, studentId, batchId);
    }
}

module.exports = new TutorPortalService();
