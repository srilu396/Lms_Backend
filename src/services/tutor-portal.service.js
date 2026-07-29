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
    LessonProgress,
    sequelize
} = require('../models');
const { Op } = require('sequelize');
const { mediaInclude, serializeWithMedia } = require('../utils/media');

function formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    if (isNaN(d.getTime())) return 'N/A';
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

    // Helper to calculate total items and completions for batch course progress calculation
    async _calculateBatchCourseProgress(batchId, courseId) {
        if (!courseId) return 0;

        const modules = await Module.findAll({
            where: { course_id: courseId },
            attributes: ['id']
        });
        const moduleIds = modules.map(m => m.id);

        const lessons = moduleIds.length > 0
            ? await Lesson.findAll({ where: { module_id: { [Op.in]: moduleIds } }, attributes: ['id'] })
            : [];
        const lessonIds = lessons.map(l => l.id);

        // Quizzes count
        const quizWhere = {
            [Op.or]: [{ course_id: courseId }]
        };
        if (moduleIds.length > 0) quizWhere[Op.or].push({ module_id: { [Op.in]: moduleIds } });
        if (lessonIds.length > 0) quizWhere[Op.or].push({ lesson_id: { [Op.in]: lessonIds } });
        const totalQuizzes = await Quiz.count({ where: quizWhere });

        // Assignments count
        const batchAssignments = await BatchAssignment.findAll({
            where: { batch_id: batchId },
            attributes: ['assignment_id']
        });
        let totalAssignments = batchAssignments.length;
        if (totalAssignments === 0) {
            const assignmentWhere = {
                [Op.or]: [{ course_id: courseId }]
            };
            if (moduleIds.length > 0) assignmentWhere[Op.or].push({ module_id: { [Op.in]: moduleIds } });
            if (lessonIds.length > 0) assignmentWhere[Op.or].push({ lesson_id: { [Op.in]: lessonIds } });
            totalAssignments = await Assignment.count({ where: assignmentWhere });
        }

        const totalItemsInCourse = lessons.length + totalQuizzes + totalAssignments;
        if (totalItemsInCourse === 0) return 0;

        // Get active enrollments for this batch
        const enrollments = await Enrollment.findAll({
            where: { batch_id: batchId, status: 'active' },
            attributes: ['id']
        });
        const enrollmentIds = enrollments.map(e => e.id);
        if (enrollmentIds.length === 0) return 0;

        // Completions
        const lessonsCompleted = await LessonProgress.count({
            where: { enrollment_id: { [Op.in]: enrollmentIds }, is_completed: true }
        });

        const quizzesCompleted = await QuizSubmission.count({
            where: { enrollment_id: { [Op.in]: enrollmentIds }, status: { [Op.in]: ['completed', 'reviewed'] } }
        });

        const assignmentsCompleted = await AssignmentSubmission.count({
            where: { enrollment_id: { [Op.in]: enrollmentIds }, status: { [Op.in]: ['submitted', 'graded'] } }
        });

        const totalCompletions = lessonsCompleted + quizzesCompleted + assignmentsCompleted;
        const maxPossible = totalItemsInCourse * enrollmentIds.length;

        return maxPossible > 0 ? Math.min(100, Math.round((totalCompletions / maxPossible) * 100)) : 0;
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

        // Count only assignment submissions waiting for tutor evaluation (status: 'submitted' or 'pending_review')
        let pendingAssignmentEvaluations = 0;
        if (tutorBatchIds.length > 0) {
            const enrollments = await Enrollment.findAll({
                where: {
                    batch_id: { [Op.in]: tutorBatchIds },
                    status: 'active'
                },
                attributes: ['id']
            });
            const enrollmentIds = enrollments.map(e => e.id);

            if (enrollmentIds.length > 0) {
                pendingAssignmentEvaluations = await AssignmentSubmission.count({
                    where: {
                        enrollment_id: { [Op.in]: enrollmentIds },
                        status: 'submitted'
                    }
                });
            }
        }

        return {
            totalAssignedBatches,
            totalStudents,
            pendingAssignmentEvaluations
        };
    }

    // ─── 2. Dashboard API (Batches List) ────────────────────────────────────────
    async getDashboardData(tutorId, filters = {}) {
        const { page = 1, limit = 10, search = '' } = filters;
        const parsedLimit = Math.max(parseInt(limit, 10) || 10, 1);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const tutorBatchRows = await BatchTutor.findAll({
            where: { tutor_id: tutorId },
            attributes: ['batch_id']
        });
        const tutorBatchIds = tutorBatchRows.map(row => row.batch_id);

        if (tutorBatchIds.length === 0) {
            return {
                data: [],
                pagination: {
                    totalItems: 0,
                    totalPages: 0,
                    currentPage: parsedPage,
                    itemsPerPage: parsedLimit
                }
            };
        }

        const whereClause = {
            id: { [Op.in]: tutorBatchIds }
        };

        if (search) {
            whereClause.name = { [Op.iLike]: `%${search}%` };
        }

        const { count, rows: batches } = await Batch.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Course,
                    attributes: ['id', 'name']
                }
            ],
            limit: parsedLimit,
            offset,
            order: [['created_at', 'DESC']],
            distinct: true
        });

        const batchData = await Promise.all(batches.map(async (batch) => {
            const progress = await this._calculateBatchCourseProgress(batch.id, batch.course_id);

            return {
                batchId: batch.id,
                batchName: batch.name,
                courseName: batch.Course ? batch.Course.name : 'N/A',
                progress
            };
        }));

        return {
            data: batchData,
            pagination: {
                totalItems: count,
                totalPages: Math.ceil(count / parsedLimit),
                currentPage: parsedPage,
                itemsPerPage: parsedLimit
            }
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
                totalBatches: 0,
                totalQuizSubmissions: 0,
                averageQuizScore: 0
            };
        }

        const batches = await Batch.findAll({ where: { id: { [Op.in]: batchIds } }, attributes: ['id', 'course_id'] });

        let totalBatches = 0;
        for (const b of batches) {
            if (b.course_id) {
                const modules = await Module.findAll({ where: { course_id: b.course_id }, attributes: ['id'] });
                const moduleIds = modules.map(m => m.id);
                const lessons = moduleIds.length > 0 ? await Lesson.findAll({ where: { module_id: { [Op.in]: moduleIds } }, attributes: ['id'] }) : [];
                const lessonIds = lessons.map(l => l.id);

                const quizWhere = {
                    [Op.or]: [{ course_id: b.course_id }]
                };
                if (moduleIds.length > 0) quizWhere[Op.or].push({ module_id: { [Op.in]: moduleIds } });
                if (lessonIds.length > 0) quizWhere[Op.or].push({ lesson_id: { [Op.in]: lessonIds } });

                const qCount = await Quiz.count({ where: quizWhere });
                if (qCount > 0) totalBatches++;
            }
        }

        const enrollments = await Enrollment.findAll({ where: { batch_id: { [Op.in]: batchIds }, status: 'active' }, attributes: ['id'] });
        const enrollmentIds = enrollments.map(e => e.id);

        let totalQuizSubmissions = 0;
        let averageQuizScore = 0;

        if (enrollmentIds.length > 0) {
            totalQuizSubmissions = await QuizSubmission.count({
                where: { enrollment_id: { [Op.in]: enrollmentIds } }
            });

            const completedSubmissions = await QuizSubmission.findAll({
                where: { enrollment_id: { [Op.in]: enrollmentIds }, status: { [Op.in]: ['completed', 'reviewed'] } },
                attributes: ['score']
            });

            if (completedSubmissions.length > 0) {
                const sumScore = completedSubmissions.reduce((sum, s) => sum + Number(s.score || 0), 0);
                averageQuizScore = Math.round(sumScore / completedSubmissions.length);
            }
        }

        return {
            totalBatches,
            totalQuizSubmissions,
            averageQuizScore
        };
    }

    async getQuizzesOverview(tutorId, filters = {}) {
        const { page = 1, limit = 10, search = '', batchId } = filters;
        const parsedLimit = Math.max(parseInt(limit, 10) || 10, 1);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const tutorBatches = await BatchTutor.findAll({ where: { tutor_id: tutorId }, attributes: ['batch_id'] });
        let batchIds = tutorBatches.map(b => b.batch_id);

        if (batchId) {
            const requestedBatchId = parseInt(batchId, 10);
            if (!batchIds.includes(requestedBatchId)) {
                throw { statusCode: 403, message: 'Access denied. You are not assigned to this batch.' };
            }
            batchIds = [requestedBatchId];
        }

        if (batchIds.length === 0) {
            return {
                data: [],
                pagination: { totalItems: 0, totalPages: 0, currentPage: parsedPage, itemsPerPage: parsedLimit }
            };
        }

        const whereClause = { id: { [Op.in]: batchIds } };
        if (search) {
            whereClause.name = { [Op.iLike]: `%${search}%` };
        }

        const { count, rows: batches } = await Batch.findAndCountAll({
            where: whereClause,
            include: [{ model: Course, attributes: ['id', 'name'] }],
            limit: parsedLimit,
            offset,
            order: [['created_at', 'DESC']]
        });

        const data = await Promise.all(batches.map(async (batch) => {
            let totalQuizzes = 0;
            if (batch.course_id) {
                const modules = await Module.findAll({ where: { course_id: batch.course_id }, attributes: ['id'] });
                const moduleIds = modules.map(m => m.id);
                const lessons = moduleIds.length > 0 ? await Lesson.findAll({ where: { module_id: { [Op.in]: moduleIds } }, attributes: ['id'] }) : [];
                const lessonIds = lessons.map(l => l.id);

                const quizWhere = {
                    [Op.or]: [{ course_id: batch.course_id }]
                };
                if (moduleIds.length > 0) quizWhere[Op.or].push({ module_id: { [Op.in]: moduleIds } });
                if (lessonIds.length > 0) quizWhere[Op.or].push({ lesson_id: { [Op.in]: lessonIds } });

                totalQuizzes = await Quiz.count({ where: quizWhere });
            }

            return {
                batchId: batch.id,
                batchName: batch.name,
                courseName: batch.Course ? batch.Course.name : 'N/A',
                totalQuizzes
            };
        }));

        return {
            data,
            pagination: {
                totalItems: count,
                totalPages: Math.ceil(count / parsedLimit),
                currentPage: parsedPage,
                itemsPerPage: parsedLimit
            }
        };
    }

    async getBatchQuizStats(tutorId, batchId) {
        await this.checkBatchAllocation(tutorId, batchId);

        const enrollments = await Enrollment.findAll({
            where: { batch_id: batchId, status: 'active' },
            attributes: ['id']
        });
        const totalStudents = enrollments.length;
        const enrollmentIds = enrollments.map(e => e.id);

        let quizAttempts = 0;
        let averageScore = 0;

        if (enrollmentIds.length > 0) {
            quizAttempts = await QuizSubmission.count({
                where: { enrollment_id: { [Op.in]: enrollmentIds } }
            });

            const completedSubmissions = await QuizSubmission.findAll({
                where: { enrollment_id: { [Op.in]: enrollmentIds }, status: { [Op.in]: ['completed', 'reviewed'] } },
                attributes: ['score']
            });

            if (completedSubmissions.length > 0) {
                const sumScore = completedSubmissions.reduce((sum, s) => sum + Number(s.score || 0), 0);
                averageScore = Math.round(sumScore / completedSubmissions.length);
            }
        }

        return {
            totalStudents,
            quizAttempts,
            averageScore
        };
    }

    async getBatchStudentQuizzes(tutorId, batchId, filters = {}) {
        await this.checkBatchAllocation(tutorId, batchId);
        const { page = 1, limit = 10, search = '' } = filters;
        const parsedLimit = Math.max(parseInt(limit, 10) || 10, 1);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

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
                pagination: { totalItems: 0, totalPages: 0, currentPage: parsedPage, itemsPerPage: parsedLimit }
            };
        }

        const studentEmails = enrollments.map(e => e.student.email);
        const users = await User.findAll({
            where: { email: { [Op.in]: studentEmails } },
            attributes: ['id', 'email']
        });
        const userMap = new Map(users.map(u => [u.email, u.id]));

        const studentList = await Promise.all(enrollments.map(async (enrollment) => {
            const student = enrollment.student;
            const userId = userMap.get(student.email) || null;

            // Get submissions for this student enrollment
            const submissions = await QuizSubmission.findAll({
                where: { enrollment_id: enrollment.id },
                include: [{ model: Quiz, attributes: ['name'] }],
                order: [['submitted_at', 'DESC'], ['created_at', 'DESC']]
            });

            const submittedQuizCount = submissions.length;
            const latestSub = submissions.length > 0 ? submissions[0] : null;
            const latestQuiz = latestSub && latestSub.Quiz ? latestSub.Quiz.name : 'N/A';
            const rawDate = latestSub ? (latestSub.submitted_at || latestSub.created_at) : null;
            const submittedOn = formatDate(rawDate);

            return {
                studentId: userId ? Number(userId) : null,
                studentProfile: student.profile_image || null,
                studentName: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
                studentEmail: student.email,
                latestQuiz,
                submittedOn,
                submittedQuizCount
            };
        }));

        const totalItems = studentList.length;
        const paginatedData = studentList.slice(offset, offset + parsedLimit);

        return {
            data: paginatedData,
            pagination: {
                totalItems,
                totalPages: Math.ceil(totalItems / parsedLimit),
                currentPage: parsedPage,
                itemsPerPage: parsedLimit
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
                totalBatches: 0,
                totalAssignmentSubmissions: 0,
                pendingEvaluations: 0
            };
        }

        const batches = await Batch.findAll({ where: { id: { [Op.in]: batchIds } }, attributes: ['id', 'course_id'] });

        let totalBatches = 0;
        for (const b of batches) {
            const batchAssignmentsCount = await BatchAssignment.count({ where: { batch_id: b.id } });
            if (batchAssignmentsCount > 0) {
                totalBatches++;
            } else if (b.course_id) {
                const modules = await Module.findAll({ where: { course_id: b.course_id }, attributes: ['id'] });
                const moduleIds = modules.map(m => m.id);
                const lessons = moduleIds.length > 0 ? await Lesson.findAll({ where: { module_id: { [Op.in]: moduleIds } }, attributes: ['id'] }) : [];
                const lessonIds = lessons.map(l => l.id);

                const assignmentWhere = {
                    [Op.or]: [{ course_id: b.course_id }]
                };
                if (moduleIds.length > 0) assignmentWhere[Op.or].push({ module_id: { [Op.in]: moduleIds } });
                if (lessonIds.length > 0) assignmentWhere[Op.or].push({ lesson_id: { [Op.in]: lessonIds } });

                const aCount = await Assignment.count({ where: assignmentWhere });
                if (aCount > 0) totalBatches++;
            }
        }

        const enrollments = await Enrollment.findAll({ where: { batch_id: { [Op.in]: batchIds }, status: 'active' }, attributes: ['id'] });
        const enrollmentIds = enrollments.map(e => e.id);

        let totalAssignmentSubmissions = 0;
        let pendingEvaluations = 0;

        if (enrollmentIds.length > 0) {
            totalAssignmentSubmissions = await AssignmentSubmission.count({
                where: {
                    enrollment_id: { [Op.in]: enrollmentIds },
                    status: { [Op.ne]: 'pending' }
                }
            });

            pendingEvaluations = await AssignmentSubmission.count({
                where: {
                    enrollment_id: { [Op.in]: enrollmentIds },
                    status: 'submitted'
                }
            });
        }

        return {
            totalBatches,
            totalAssignmentSubmissions,
            pendingEvaluations
        };
    }

    async getAssignmentsOverview(tutorId, filters = {}) {
        const { page = 1, limit = 10, search = '', batchId } = filters;
        const parsedLimit = Math.max(parseInt(limit, 10) || 10, 1);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const tutorBatches = await BatchTutor.findAll({ where: { tutor_id: tutorId }, attributes: ['batch_id'] });
        let batchIds = tutorBatches.map(b => b.batch_id);

        if (batchId) {
            const requestedBatchId = parseInt(batchId, 10);
            if (!batchIds.includes(requestedBatchId)) {
                throw { statusCode: 403, message: 'Access denied. You are not assigned to this batch.' };
            }
            batchIds = [requestedBatchId];
        }

        if (batchIds.length === 0) {
            return {
                data: [],
                pagination: { totalItems: 0, totalPages: 0, currentPage: parsedPage, itemsPerPage: parsedLimit }
            };
        }

        const whereClause = { id: { [Op.in]: batchIds } };
        if (search) {
            whereClause.name = { [Op.iLike]: `%${search}%` };
        }

        const { count, rows: batches } = await Batch.findAndCountAll({
            where: whereClause,
            include: [{ model: Course, attributes: ['id', 'name'] }],
            limit: parsedLimit,
            offset,
            order: [['created_at', 'DESC']]
        });

        const data = await Promise.all(batches.map(async (batch) => {
            const batchAssignmentsCount = await BatchAssignment.count({ where: { batch_id: batch.id } });
            let totalAssignments = batchAssignmentsCount;

            if (totalAssignments === 0 && batch.course_id) {
                const modules = await Module.findAll({ where: { course_id: batch.course_id }, attributes: ['id'] });
                const moduleIds = modules.map(m => m.id);
                const lessons = moduleIds.length > 0 ? await Lesson.findAll({ where: { module_id: { [Op.in]: moduleIds } }, attributes: ['id'] }) : [];
                const lessonIds = lessons.map(l => l.id);

                const assignmentWhere = {
                    [Op.or]: [{ course_id: batch.course_id }]
                };
                if (moduleIds.length > 0) assignmentWhere[Op.or].push({ module_id: { [Op.in]: moduleIds } });
                if (lessonIds.length > 0) assignmentWhere[Op.or].push({ lesson_id: { [Op.in]: lessonIds } });

                totalAssignments = await Assignment.count({ where: assignmentWhere });
            }

            return {
                batchId: batch.id,
                batchName: batch.name,
                courseName: batch.Course ? batch.Course.name : 'N/A',
                totalAssignments
            };
        }));

        return {
            data,
            pagination: {
                totalItems: count,
                totalPages: Math.ceil(count / parsedLimit),
                currentPage: parsedPage,
                itemsPerPage: parsedLimit
            }
        };
    }

    async getBatchAssignmentStats(tutorId, batchId) {
        await this.checkBatchAllocation(tutorId, batchId);

        const enrollments = await Enrollment.findAll({
            where: { batch_id: batchId, status: 'active' },
            attributes: ['id']
        });
        const totalStudents = enrollments.length;
        const enrollmentIds = enrollments.map(e => e.id);

        let submittedAssignments = 0;
        let pendingEvaluations = 0;

        if (enrollmentIds.length > 0) {
            submittedAssignments = await AssignmentSubmission.count({
                where: {
                    enrollment_id: { [Op.in]: enrollmentIds },
                    status: { [Op.ne]: 'pending' }
                }
            });

            pendingEvaluations = await AssignmentSubmission.count({
                where: {
                    enrollment_id: { [Op.in]: enrollmentIds },
                    status: 'submitted'
                }
            });
        }

        return {
            totalStudents,
            submittedAssignments,
            pendingEvaluations
        };
    }

    async getBatchStudentAssignments(tutorId, batchId, filters = {}) {
        await this.checkBatchAllocation(tutorId, batchId);
        const { page = 1, limit = 10, search = '' } = filters;
        const parsedLimit = Math.max(parseInt(limit, 10) || 10, 1);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

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
                pagination: { totalItems: 0, totalPages: 0, currentPage: parsedPage, itemsPerPage: parsedLimit }
            };
        }

        const studentEmails = enrollments.map(e => e.student.email);
        const users = await User.findAll({
            where: { email: { [Op.in]: studentEmails } },
            attributes: ['id', 'email']
        });
        const userMap = new Map(users.map(u => [u.email, u.id]));

        const studentList = await Promise.all(enrollments.map(async (enrollment) => {
            const student = enrollment.student;
            const userId = userMap.get(student.email) || null;

            // Get submissions for this student enrollment
            const submissions = await AssignmentSubmission.findAll({
                where: {
                    enrollment_id: enrollment.id,
                    status: { [Op.ne]: 'pending' }
                },
                include: [{ model: Assignment, attributes: ['title'] }],
                order: [['submitted_at', 'DESC'], ['created_at', 'DESC']]
            });

            const submittedAssignmentCount = submissions.length;
            const latestSub = submissions.length > 0 ? submissions[0] : null;
            const latestAssignment = latestSub && latestSub.Assignment ? latestSub.Assignment.title : 'N/A';
            const rawDate = latestSub ? (latestSub.submitted_at || latestSub.created_at) : null;
            const submittedOn = formatDate(rawDate);

            return {
                studentId: userId ? Number(userId) : null,
                studentProfile: student.profile_image || null,
                studentName: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
                studentEmail: student.email,
                latestAssignment,
                submittedOn,
                submittedAssignmentCount
            };
        }));

        const totalItems = studentList.length;
        const paginatedData = studentList.slice(offset, offset + parsedLimit);

        return {
            data: paginatedData,
            pagination: {
                totalItems,
                totalPages: Math.ceil(totalItems / parsedLimit),
                currentPage: parsedPage,
                itemsPerPage: parsedLimit
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
