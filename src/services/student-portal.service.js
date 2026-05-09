const models = require('../models');
const {
    Student,
    Enrollment,
    Batch,
    Course,
    Module,
    Topic,
    Lesson,
    Quiz,
    QuizSubmission,
    AssignmentSubmission,
    StudentAttendance,
    LessonProgress,
    User,
    Assignment,
    QuizAnswer,
    QuizQuestion
} = models;
const { Op } = require('sequelize');

class StudentPortalService {

    // ─── Helper: resolve Student record from logged-in User ─────────────────────
    async _getStudentByUserId(userId) {
        const user = await User.findByPk(userId, { attributes: ['email'] });
        if (!user) throw { statusCode: 401, message: 'User not found' };

        const student = await Student.findOne({ where: { email: user.email } });
        if (!student) throw { statusCode: 404, message: 'Student profile not found for this account' };

        return student;
    }

    // ─── 1. Profile ─────────────────────────────────────────────────────────────
    async getProfile(userId) {
        const student = await this._getStudentByUserId(userId);

        const profile = await Student.findByPk(student.id, {
            attributes: { exclude: ['password'] },
            include: [
                {
                    model: Course,
                    as: 'course',
                    attributes: ['id', 'name', 'description'],
                    required: false
                }
            ]
        });

        return profile;
    }

    // ─── 2. Stats (Dashboard Overview Cards) ────────────────────────────────────
    async getStats(userId) {
        const student = await this._getStudentByUserId(userId);

        // Active enrollments
        const activeEnrollments = await Enrollment.count({
            where: { student_id: student.id, status: 'active' }
        });

        // Total quizzes attempted
        const quizzesAttempted = await QuizSubmission.count({
            where: { student_id: userId }
        });

        // Total assignments submitted
        const assignmentsSubmitted = await AssignmentSubmission.count({
            include: [
                {
                    model: Enrollment,
                    where: { student_id: student.id },
                    required: true
                }
            ]
        });

        return {
            active_batches: activeEnrollments,
            quizzes_attempted: quizzesAttempted,
            assignments_submitted: assignmentsSubmitted
        };
    }

    // ─── 3. My Batches (Dashboard table) ────────────────────────────────────────
    async getMyBatches(userId, filters = {}) {
        const student = await this._getStudentByUserId(userId);

        const { page = 1, limit = 10, search = '', status } = filters;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        // Get all enrollments for this student
        const enrollmentWhere = { student_id: student.id };
        if (status) enrollmentWhere.status = status;

        const { count, rows: enrollments } = await Enrollment.findAndCountAll({
            where: enrollmentWhere,
            include: [
                {
                    model: Batch,
                    required: true,
                    where: search ? { name: { [Op.iLike]: `%${search}%` } } : {},
                    include: [
                        {
                            model: Course,
                            attributes: ['id', 'name']
                        }
                    ]
                }
            ],
            limit: parsedLimit,
            offset,
            order: [['created_at', 'DESC']],
            distinct: true
        });

        const data = enrollments.map(enrollment => ({
            enrollment_id: enrollment.id,
            enrollment_status: enrollment.status,
            enrollment_date: enrollment.enrollment_date,
            batch: {
                id: enrollment.Batch.id,
                name: enrollment.Batch.name,
                status: enrollment.Batch.status,
                start_date: enrollment.Batch.start_date,
                end_date: enrollment.Batch.end_date,
                course: enrollment.Batch.Course
                    ? { id: enrollment.Batch.Course.id, name: enrollment.Batch.Course.name }
                    : null
            }
        }));

        return {
            total_items: count,
            total_pages: Math.ceil(count / parsedLimit),
            current_page: parsedPage,
            items_per_page: parsedLimit,
            data
        };
    }

    // ─── 4. Batch Course Structure ───────────────────────────────────────────────
    async getBatchCourseStructure(userId, batchId) {
        const student = await this._getStudentByUserId(userId);

        // Verify student is enrolled in this batch
        const enrollment = await Enrollment.findOne({
            where: { student_id: student.id, batch_id: batchId }
        });
        if (!enrollment) {
            throw { statusCode: 403, message: 'Access denied. You are not enrolled in this batch.' };
        }

        const batch = await Batch.findByPk(batchId, {
            include: [{ model: Course, attributes: ['id', 'name', 'description'] }]
        });
        if (!batch) throw { statusCode: 404, message: 'Batch not found' };
        if (!batch.course_id) throw { statusCode: 404, message: 'No course assigned to this batch yet.' };

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
                            ]
                        }
                    ]
                }
            ]
        });

        return {
            batch_id: batch.id,
            batch_name: batch.name,
            batch_status: batch.status,
            course_structure: courseStructure
        };
    }

    // ─── 5. Attendance for a specific batch ─────────────────────────────────────
    async getMyAttendance(userId, batchId, filters = {}) {
        const student = await this._getStudentByUserId(userId);

        const enrollment = await Enrollment.findOne({
            where: { student_id: student.id, batch_id: batchId }
        });
        if (!enrollment) {
            throw { statusCode: 403, message: 'Access denied. You are not enrolled in this batch.' };
        }

        const { page = 1, limit = 10 } = filters;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        // Full summary counts (all records, not just the current page)
        const allAttendance = await StudentAttendance.findAll({
            where: { enrollment_id: enrollment.id },
            attributes: ['status']
        });
        const summaryTotal = allAttendance.length;
        const present = allAttendance.filter(r => r.status === 'present').length;
        const absent  = allAttendance.filter(r => r.status === 'absent').length;
        const late    = allAttendance.filter(r => r.status === 'late').length;

        // Paginated records
        const { count, rows } = await StudentAttendance.findAndCountAll({
            where: { enrollment_id: enrollment.id },
            limit: parsedLimit,
            offset,
            order: [['marked_at', 'DESC']]  // StudentAttendance has no 'date' column
        });

        return {
            summary: { total: summaryTotal, present, absent, late },
            total_items: count,
            total_pages: Math.ceil(count / parsedLimit),
            current_page: parsedPage,
            items_per_page: parsedLimit,
            data: rows
        };
    }

    // ─── 6. Quiz submissions ─────────────────────────────────────────────────────
    async getMyQuizzes(userId, filters = {}) {
        const { page = 1, limit = 10 } = filters;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const { count, rows } = await QuizSubmission.findAndCountAll({
            where: { student_id: userId },
            include: [
                {
                    model: Quiz,
                    attributes: ['id', 'title', 'pass_mark', 'total_marks']
                }
            ],
            limit: parsedLimit,
            offset,
            order: [['submitted_at', 'DESC']],
            distinct: true
        });

        return {
            total_items: count,
            total_pages: Math.ceil(count / parsedLimit),
            current_page: parsedPage,
            items_per_page: parsedLimit,
            data: rows
        };
    }

    // ─── 7. Assignment submissions ──────────────────────────────────────────────
    async getMyAssignments(userId, filters = {}) {
        const { page = 1, limit = 10 } = filters;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const { count, rows } = await AssignmentSubmission.findAndCountAll({
            where: { student_id: userId },
            include: [
                {
                    model: models.Assignment, // Using models from models/index if available or requiring directly
                    attributes: ['id', 'title', 'total_marks']
                }
            ],
            limit: parsedLimit,
            offset,
            order: [['submitted_at', 'DESC']],
            distinct: true
        });

        return {
            total_items: count,
            total_pages: Math.ceil(count / parsedLimit),
            current_page: parsedPage,
            items_per_page: parsedLimit,
            data: rows
        };
    }

    // ─── 8. Detailed Quiz Review ────────────────────────────────────────────────
    async getQuizSubmissionReview(userId, quizId) {
        // Find the latest submission for this user and quiz
        const submission = await QuizSubmission.findOne({
            where: { student_id: userId, quiz_id: quizId },
            include: [
                {
                    model: Quiz,
                    attributes: ['id', 'title', 'total_marks', 'pass_mark']
                },
                {
                    model: models.QuizAnswer,
                    include: [
                        {
                            model: models.QuizQuestion,
                            attributes: ['id', 'question_text', 'question_type', 'options', 'correct_answer']
                        }
                    ]
                }
            ],
            order: [['attempt_number', 'DESC']]
        });

        if (!submission) {
            throw { statusCode: 404, message: 'Quiz submission not found' };
        }

        return submission;
    }

    // ─── 9. Update Profile ──────────────────────────────────────────────────────
    async updateProfile(userId, updateData) {
        const student = await this._getStudentByUserId(userId);
        const user = await User.findByPk(userId);

        if (!student || !user) {
            throw { statusCode: 404, message: 'Student or User not found' };
        }

        // Fields allowed to be updated in Student model
        const studentFields = ['first_name', 'last_name', 'mobile_number', 'notes', 'profile_image'];
        const studentUpdate = {};
        studentFields.forEach(field => {
            if (updateData[field] !== undefined) {
                studentUpdate[field] = updateData[field];
            }
        });

        // Update Student
        await student.update(studentUpdate);

        // Sync with User model if necessary
        const userUpdate = {};
        if (updateData.first_name || updateData.last_name) {
            const firstName = updateData.first_name || student.first_name;
            const lastName = updateData.last_name || student.last_name;
            userUpdate.full_name = `${firstName} ${lastName}`;
        }
        
        // If email update is provided, sync it (assuming it's already validated)
        if (updateData.email && updateData.email !== user.email) {
            // Optional: check for email uniqueness if not handled by DB unique constraint
            const emailInUse = await User.findOne({ where: { email: updateData.email, id: { [Op.ne]: userId } } });
            if (emailInUse) {
                throw { statusCode: 400, message: 'Email already in use' };
            }
            userUpdate.email = updateData.email;
            await student.update({ email: updateData.email });
        }

        if (Object.keys(userUpdate).length > 0) {
            await user.update(userUpdate);
        }

        return await this.getProfile(userId);
    }

    // ─── 10. Enrolled Courses (Table Data) ──────────────────────────────────────
    async getEnrolledCourses(userId, filters = {}) {
        const student = await this._getStudentByUserId(userId);
        const { search = '', page = 1, limit = 10 } = filters;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        // 1. Fetch Enrollments with Batch and Course details
        const { count, rows: enrollments } = await Enrollment.findAndCountAll({
            where: { student_id: student.id },
            include: [
                {
                    model: Batch,
                    required: true,
                    include: [
                        {
                            model: Course,
                            required: true,
                            where: search ? { name: { [Op.iLike]: `%${search}%` } } : {},
                            include: [
                                {
                                    model: models.CourseTutor,
                                    as: 'course_tutors',
                                    where: { role: 'primary' },
                                    required: false,
                                    include: [{ model: User, attributes: ['full_name'] }]
                                }
                            ]
                        }
                    ]
                }
            ],
            limit: parsedLimit,
            offset,
            order: [['created_at', 'DESC']],
            distinct: true
        });

        // 2. Process each enrollment to calculate progress and format response
        const formattedData = await Promise.all(enrollments.map(async (enrollment) => {
            const course = enrollment.Batch.Course;
            
            // Calculate progress
            // Get all lesson IDs for this course
            const modules = await models.Module.findAll({
                where: { course_id: course.id },
                include: [{
                    model: models.Topic,
                    as: 'topics',
                    include: [{ model: models.Lesson, as: 'lessons', attributes: ['id'] }]
                }]
            });

            const lessonIds = [];
            modules.forEach(m => {
                m.topics.forEach(t => {
                    t.lessons.forEach(l => lessonIds.push(l.id));
                });
            });

            let completionProgress = 0;
            let lastOpened = null;

            if (lessonIds.length > 0) {
                const completedCount = await LessonProgress.count({
                    where: {
                        enrollment_id: enrollment.id,
                        lesson_id: { [Op.in]: lessonIds },
                        is_completed: true
                    }
                });
                completionProgress = Math.round((completedCount / lessonIds.length) * 100);

                const lastAccessRecord = await LessonProgress.findOne({
                    where: {
                        enrollment_id: enrollment.id,
                        lesson_id: { [Op.in]: lessonIds }
                    },
                    order: [['last_accessed', 'DESC']],
                    attributes: ['last_accessed']
                });
                lastOpened = lastAccessRecord ? lastAccessRecord.last_accessed : null;
            }

            const primaryTutor = course.course_tutors && course.course_tutors[0] ? course.course_tutors[0].User : null;

            return {
                courseId: course.id,
                courseName: course.name,
                courseImage: course.thumbnail_url || null,
                tags: [], // Placeholder for future tag feature
                tutor: {
                    name: primaryTutor ? primaryTutor.full_name : 'N/A',
                    image: null // Placeholder if user/tutor profile image is added
                },
                completionProgress,
                lastOpened
            };
        }));

        return {
            data: formattedData,
            pagination: {
                currentPage: parsedPage,
                totalPages: Math.ceil(count / parsedLimit),
                totalRecords: count,
                rowsPerPage: parsedLimit
            }
        };
    }
}

module.exports = new StudentPortalService();
