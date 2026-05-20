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
    AttendanceSession,
    LessonProgress,
    User,
    Assignment,
    QuizAnswer,
    QuizQuestion,
    Note
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

    // ─── 11. Inside Course View (Learning Page) ─────────────────────────────────
    async getCourseView(userId, courseId) {
        const student = await this._getStudentByUserId(userId);

        // 1. Find the active enrollment for this student and course
        const enrollment = await Enrollment.findOne({
            include: [{
                model: Batch,
                where: { course_id: courseId },
                required: true
            }],
            where: { student_id: student.id, status: 'active' }
        });

        if (!enrollment) {
            throw { statusCode: 403, message: 'Access denied. You are not enrolled in this course.' };
        }

        // 2. Fetch full course structure with content
        const course = await Course.findByPk(courseId, {
            attributes: ['id', 'name', 'description', 'thumbnail_url'],
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
                                    attributes: ['id', 'name', 'order_num', 'type', 'content_text', 'video_url', 'image_url', 'duration_minutes'],
                                    include: [
                                        { model: Quiz, as: 'quizzes', attributes: ['id', 'name'] },
                                        { model: Assignment, as: 'assignments', attributes: ['id', 'title'] }
                                    ]
                                },
                                { model: Quiz, as: 'quizzes', attributes: ['id', 'name'] },
                                { model: Assignment, as: 'assignments', attributes: ['id', 'title'] }
                            ]
                        },
                        { model: Quiz, as: 'quizzes', attributes: ['id', 'name'] },
                        { model: Assignment, as: 'assignments', attributes: ['id', 'title'] }
                    ]
                }
            ],
            order: [
                [{ model: Module, as: 'modules' }, 'order_num', 'ASC'],
                [{ model: Module, as: 'modules' }, { model: Topic, as: 'topics' }, 'order_num', 'ASC'],
                [{ model: Module, as: 'modules' }, { model: Topic, as: 'topics' }, { model: Lesson, as: 'lessons' }, 'order_num', 'ASC']
            ]
        });

        // 3. Fetch lesson progress for this enrollment
        const lessonProgress = await LessonProgress.findAll({
            where: { enrollment_id: enrollment.id }
        });
        const progressMap = {};
        lessonProgress.forEach(lp => {
            progressMap[lp.lesson_id] = lp;
        });

        // 4. Transform data and calculate module-level locking
        let totalLessonsInCourse = 0;
        let completedLessonsInCourse = 0;
        let prevModuleCompleted = true; // First module is always unlocked

        const modules = course.modules.map((mod, modIdx) => {
            let totalLessonsInMod = 0;
            let completedLessonsInMod = 0;

            const topics = mod.topics.map(top => {
                const lessons = top.lessons.map(les => {
                    totalLessonsInMod++;
                    totalLessonsInCourse++;
                    const progress = progressMap[les.id];
                    const isCompleted = progress ? progress.is_completed : false;
                    if (isCompleted) {
                        completedLessonsInMod++;
                        completedLessonsInCourse++;
                    }

                    return {
                        ...les.toJSON(),
                        isCompleted,
                        progressPct: progress ? parseFloat(progress.video_watch_pct || 0) : 0,
                        lastAccessed: progress ? progress.last_accessed : null
                    };
                });

                return {
                    ...top.toJSON(),
                    isCompleted: lessons.length > 0 && lessons.every(l => l.isCompleted),
                    lessons
                };
            });

            const progressPct = totalLessonsInMod > 0 ? Math.round((completedLessonsInMod / totalLessonsInMod) * 100) : 0;
            const isLocked = !prevModuleCompleted;
            
            // Update prevModuleCompleted for the next module
            prevModuleCompleted = (progressPct === 100);

            return {
                ...mod.toJSON(),
                progressPct,
                isLocked,
                isCompleted: progressPct === 100,
                topics
            };
        });

        return {
            course: {
                id: course.id,
                name: course.name,
                description: course.description,
                thumbnail: course.thumbnail_url,
                totalProgress: totalLessonsInCourse > 0 ? Math.round((completedLessonsInCourse / totalLessonsInCourse) * 100) : 0,
                enrollmentId: enrollment.id,
                modules
            }
        };
    }

    // ─── 12. Mark Lesson Completed ───────────────────────────────────────────────
    async completeLesson(userId, lessonId, data = {}) {
        const student = await this._getStudentByUserId(userId);
        
        // Find enrollment for this lesson's course
        const lesson = await Lesson.findByPk(lessonId, {
            include: [{ model: Topic, include: [{ model: Module }] }]
        });
        if (!lesson) throw { statusCode: 404, message: 'Lesson not found' };

        const enrollment = await Enrollment.findOne({
            include: [{
                model: Batch,
                where: { course_id: lesson.Topic.Module.course_id },
                required: true
            }],
            where: { student_id: student.id, status: 'active' }
        });

        if (!enrollment) throw { statusCode: 403, message: 'Access denied. You are not enrolled in this course.' };

        // Use the existing ProgressService logic
        const progressService = require('./progress.service');
        return await progressService.updateLessonProgress(userId, enrollment.id, lessonId, {
            is_completed: data.is_completed !== undefined ? data.is_completed : true,
            video_watch_pct: data.video_watch_pct || 100
        });
    }

    // ─── 13. Course Sidebar API (Lightweight Structure) ────────────────────────
    async getCourseSidebar(userId, courseId) {
        const student = await this._getStudentByUserId(userId);

        const enrollment = await Enrollment.findOne({
            include: [{ model: Batch, where: { course_id: courseId }, required: true }],
            where: { student_id: student.id, status: 'active' }
        });
        if (!enrollment) throw { statusCode: 403, message: 'Access denied. You are not enrolled in this course.' };

        const course = await Course.findByPk(courseId, {
            attributes: ['id', 'name'],
            include: [
                {
                    model: Module,
                    as: 'modules',
                    attributes: ['id', 'name', 'order_num'],
                    include: [
                        {
                            model: Topic,
                            as: 'topics',
                            attributes: ['id', 'name', 'order_num'],
                            include: [
                                {
                                    model: Lesson,
                                    as: 'lessons',
                                    attributes: ['id', 'name', 'order_num', 'type']
                                }
                            ]
                        }
                    ]
                }
            ],
            order: [
                [{ model: Module, as: 'modules' }, 'order_num', 'ASC'],
                [{ model: Module, as: 'modules' }, { model: Topic, as: 'topics' }, 'order_num', 'ASC'],
                [{ model: Module, as: 'modules' }, { model: Topic, as: 'topics' }, { model: Lesson, as: 'lessons' }, 'order_num', 'ASC']
            ]
        });

        const lessonProgress = await LessonProgress.findAll({
            where: { enrollment_id: enrollment.id },
            attributes: ['lesson_id', 'is_completed']
        });
        const progressMap = {};
        lessonProgress.forEach(lp => progressMap[lp.lesson_id] = lp.is_completed);

        const sidebarData = [];
        let prevModuleCompleted = true; // Module 1 is never locked

        for (const mod of course.modules) {
            let totalLessonsInMod = 0;
            let completedLessonsInMod = 0;

            const topics = mod.topics.map(top => {
                const lessons = top.lessons.map(les => {
                    totalLessonsInMod++;
                    const isCompleted = progressMap[les.id] || false;
                    if (isCompleted) completedLessonsInMod++;
                    return { id: les.id, name: les.name, type: les.type, isCompleted };
                });
                return {
                    id: top.id,
                    name: top.name,
                    isCompleted: lessons.length > 0 && lessons.every(l => l.isCompleted),
                    lessons
                };
            });

            const progressPct = totalLessonsInMod > 0 ? Math.round((completedLessonsInMod / totalLessonsInMod) * 100) : 0;
            const isLocked = !prevModuleCompleted;
            
            // Update for next iteration
            prevModuleCompleted = (progressPct === 100);

            sidebarData.push({
                id: mod.id,
                name: mod.name,
                progressPct,
                isLocked,
                topics
            });
        }

        return {
            courseId: course.id,
            courseName: course.name,
            sidebar: sidebarData
        };
    }

    // ─── 14. Simplified Notes API ──────────────────────────────────────────────
    async getLessonNote(userId, lessonId) {
        return await Note.findOne({
            where: { student_id: userId, lesson_id: lessonId }
        });
    }

    async saveLessonNote(userId, lessonId, data) {
        const { courseId, content } = data;
        
        // Find if note exists, if so update it, otherwise create it
        const [note, created] = await Note.findOrCreate({
            where: { student_id: userId, lesson_id: lessonId },
            defaults: {
                course_id: courseId,
                content: content || ''
            }
        });

        if (!created) {
            await note.update({ content });
        }

        return note;
    }

    // ─── 15. Course Completion ──────────────────────────────────────────────────
    async completeCourse(userId, courseId) {
        const student = await this._getStudentByUserId(userId);

        // 1. Find the enrollment
        const enrollment = await Enrollment.findOne({
            include: [{ model: Batch, where: { course_id: courseId }, required: true }],
            where: { student_id: student.id, status: 'active' }
        });
        if (!enrollment) throw { statusCode: 403, message: 'Active enrollment not found for this course.' };

        // 2. Calculate current progress to ensure it's 100%
        const courseData = await this.getCourseView(userId, courseId);
        if (courseData.course.totalProgress < 100) {
            throw { 
                statusCode: 400, 
                message: `Course is only ${courseData.course.totalProgress}% complete. Please finish all lessons before completing the course.` 
            };
        }

        // 3. Update Enrollment status
        await enrollment.update({ status: 'completed' });

        return {
            success: true,
            message: 'Congratulations! You have successfully completed the course.',
            courseId: courseId,
            completedAt: new Date()
        };
    }

    // ─── 16. Attendance APIs ──────────────────────────────────────────────────
    
    async getAttendanceStats(userId) {
        const student = await this._getStudentByUserId(userId);
        
        // 1. Get all attendance records for the student
        const attendance = await StudentAttendance.findAll({
            where: { student_id: userId },
            include: [{ 
                model: AttendanceSession, 
                attributes: ['session_date'] 
            }],
            order: [[AttendanceSession, 'session_date', 'DESC']]
        });

        const totalSessions = attendance.length;
        if (totalSessions === 0) {
            return {
                total_days_present: 0,
                average_attendance_percentage: 0,
                streak: 0
            };
        }

        const presentDays = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
        const avgPercentage = Math.round((presentDays / totalSessions) * 100);

        // 2. Calculate Streak
        let streak = 0;
        for (const record of attendance) {
            if (record.status === 'present' || record.status === 'late') {
                streak++;
            } else {
                break; // Streak broken
            }
        }

        return {
            total_days_present: presentDays,
            average_attendance_percentage: avgPercentage,
            streak: streak
        };
    }

    async getAttendanceTable(userId, query) {
        const student = await this._getStudentByUserId(userId);
        const { page = 1, limit = 10, search = '', status } = query;
        const offset = (page - 1) * limit;

        const whereClause = { student_id: userId };
        if (status) whereClause.status = status;

        // Fetch attendance with sessions and batches for course name
        const { count, rows } = await StudentAttendance.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: AttendanceSession,
                    attributes: ['session_date'],
                    include: [{
                        model: Batch,
                        attributes: ['name'],
                        include: [{ model: Course, attributes: ['name'] }]
                    }]
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [[AttendanceSession, 'session_date', 'DESC']]
        });

        // Helper to get day name
        const getDayName = (dateStr) => {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return days[new Date(dateStr).getDay()];
        };

        const data = rows.map(a => ({
            id: a.id,
            date: a.AttendanceSession.session_date,
            day: getDayName(a.AttendanceSession.session_date),
            course: a.AttendanceSession.Batch.Course.name,
            batch: a.AttendanceSession.Batch.name,
            status: a.status,
            notes: a.notes
        }));

        return {
            data,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        };
    }

    // ─── 16. Student Quiz APIs ──────────────────────────────────────────────────
    
    async getCourseQuiz(userId, courseId, quizId) {
        const student = await this._getStudentByUserId(userId);

        // 1. Verify student is enrolled in this course
        const enrollment = await Enrollment.findOne({
            include: [{ model: Batch, where: { course_id: courseId }, required: true }],
            where: { student_id: student.id, status: 'active' }
        });
        if (!enrollment) {
            throw { statusCode: 403, message: 'Access denied. You are not enrolled in this course.' };
        }

        // 2. Fetch quiz
        const quiz = await Quiz.findByPk(quizId, {
            attributes: ['id', 'name', 'time_limit_minutes']
        });
        if (!quiz) throw { statusCode: 404, message: 'Quiz not found' };

        // 3. Fetch questions
        const questions = await QuizQuestion.findAll({
            where: { quiz_id: quizId },
            attributes: ['id', 'question_text', 'options', 'type'],
            order: [['order_num', 'ASC']]
        });

        // 4. Format options if they are stored as array of strings
        const formattedQuestions = questions.map(q => {
            let options = q.options;
            if (Array.isArray(options) && typeof options[0] === 'string') {
                options = options.map((opt, index) => ({
                    optionId: String(index),
                    option: opt
                }));
            }
            return {
                questionId: String(q.id),
                question: q.question_text,
                options: options || []
            };
        });

        return {
            quizId: String(quiz.id),
            quizTitle: quiz.name,
            quizTime: quiz.time_limit_minutes || 0,
            courseId: String(courseId),
            questions: formattedQuestions
        };
    }

    async submitQuiz(userId, courseId, quizId, data) {
        const student = await this._getStudentByUserId(userId);
        const { answers, submittedAt, isAutoSubmitted } = data;

        if (!answers || !Array.isArray(answers) || answers.length === 0) {
            throw { statusCode: 400, message: 'No answers provided' };
        }

        // Verify student is enrolled in this course
        const enrollment = await Enrollment.findOne({
            include: [{ model: Batch, where: { course_id: courseId }, required: true }],
            where: { student_id: student.id, status: 'active' }
        });
        
        if (!enrollment) {
            throw { statusCode: 403, message: 'Access denied. You are not enrolled in this course.' };
        }

        // 3. Prevent duplicate final submissions
        const existingSubmission = await QuizSubmission.findOne({
            where: { student_id: userId, quiz_id: quizId, enrollment_id: enrollment.id }
        });
        if (existingSubmission) {
            throw { statusCode: 400, message: 'Quiz already submitted' };
        }

        // 4. Calculate score
        let score = 0;
        const totalQuestions = await QuizQuestion.count({ where: { quiz_id: quizId } });

        // Fetch all questions for this quiz to compare answers
        const quizQuestions = await QuizQuestion.findAll({ where: { quiz_id: quizId } });
        const questionMap = {};
        quizQuestions.forEach(q => questionMap[q.id] = q);

        // 5. Create submission record
        const submission = await QuizSubmission.create({
            student_id: userId, // Use userId to avoid foreign key violation
            quiz_id: quizId,
            enrollment_id: enrollment.id,
            attempt_number: 1,
            status: 'completed',
            submitted_at: submittedAt || new Date()
        });

        // 6. Save answers and calculate score
        for (const ans of answers) {
            const q = questionMap[ans.questionId];
            if (!q) continue;

            let selectedAnswerText = null;
            if (ans.selectedOptionId !== null && ans.selectedOptionId !== undefined) {
                const optionIndex = parseInt(ans.selectedOptionId, 10);
                if (Array.isArray(q.options) && optionIndex >= 0 && optionIndex < q.options.length) {
                    selectedAnswerText = q.options[optionIndex];
                }
            }

            const isCorrect = selectedAnswerText === q.correct_answer;
            if (isCorrect) {
                score += q.marks || 1;
            }

            await QuizAnswer.create({
                submission_id: submission.id,
                question_id: q.id,
                selected_answer: selectedAnswerText,
                is_correct: isCorrect
            });
        }

        // Update submission with score
        await submission.update({ score });

        return {
            submissionId: String(submission.id),
            quizId: String(quizId),
            courseId: String(courseId),
            studentId: String(student.id),
            submittedAt: submission.submitted_at,
            isAutoSubmitted: isAutoSubmitted || false,
            totalQuestions,
            answeredQuestions: answers.length
        };
    }

    async getQuizResult(userId, courseId, quizId) {
        const student = await this._getStudentByUserId(userId);

        const submission = await QuizSubmission.findOne({
            where: { student_id: userId, quiz_id: quizId },
            order: [['attempt_number', 'DESC']]
        });

        if (!submission) {
            throw { statusCode: 404, message: 'Quiz submission not found' };
        }

        const totalQuestions = await QuizQuestion.count({ where: { quiz_id: quizId } });
        
        const quizAnswers = await QuizAnswer.findAll({
            where: { submission_id: submission.id }
        });

        const correctAnswers = quizAnswers.filter(a => a.is_correct).length;
        const wrongAnswers = quizAnswers.length - correctAnswers;
        const quizPercentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;

        // Grade calculation
        let grade = 'D';
        if (quizPercentage >= 90) grade = 'A+';
        else if (quizPercentage >= 80) grade = 'A';
        else if (quizPercentage >= 70) grade = 'B';
        else if (quizPercentage >= 50) grade = 'C';

        return {
            quizId: String(quizId),
            courseId: String(courseId),
            studentId: String(student.id),
            result: {
                totalQuestions,
                correctAnswers,
                wrongAnswers,
                quizPercentage,
                timeTaken: {
                    minutes: 10, // Fallback as we don't track start time
                    seconds: 0
                },
                grade
            }
        };
    }

    async getCourseQuizReview(userId, courseId, quizId, filters = {}) {
        const student = await this._getStudentByUserId(userId);
        const { status } = filters;

        const submission = await QuizSubmission.findOne({
            where: { student_id: userId, quiz_id: quizId },
            include: [
                {
                    model: QuizAnswer,
                    include: [
                        {
                            model: QuizQuestion,
                            attributes: ['id', 'question_text', 'options', 'correct_answer']
                        }
                    ]
                }
            ],
            order: [['attempt_number', 'DESC']]
        });

        if (!submission) {
            throw { statusCode: 404, message: 'Quiz submission not found' };
        }

        let review = submission.QuizAnswers.map(ans => {
            const q = ans.QuizQuestion;
            
            let selectedOptionId = null;
            let selectedOptionText = ans.selected_answer;
            if (Array.isArray(q.options)) {
                const idx = q.options.indexOf(selectedOptionText);
                if (idx !== -1) selectedOptionId = String(idx);
            }

            let correctOptionId = null;
            let correctOptionText = q.correct_answer;
            if (Array.isArray(q.options)) {
                const idx = q.options.indexOf(correctOptionText);
                if (idx !== -1) correctOptionId = String(idx);
            }

            return {
                questionId: String(q.id),
                question: q.question_text,
                studentSelectedAnswer: {
                    optionId: selectedOptionId,
                    option: selectedOptionText
                },
                correctAnswer: {
                    optionId: correctOptionId,
                    option: correctOptionText
                },
                isCorrect: ans.is_correct,
                explanation: "Explanation for this answer is currently unavailable." // Fallback for UI
            };
        });

        // Apply filtering if requested
        if (status === 'correct') {
            review = review.filter(r => r.isCorrect);
        } else if (status === 'incorrect') {
            review = review.filter(r => !r.isCorrect);
        }

        return {
            quizId: String(quizId),
            courseId: String(courseId),
            studentId: String(student.id),
            review
        };
    }

    // ─── 17. Student Assignment Completion APIs ────────────────────────────────
    
    async getCourseAssignment(userId, courseId, assignmentId) {
        const student = await this._getStudentByUserId(userId);

        const enrollment = await Enrollment.findOne({
            include: [{ model: Batch, where: { course_id: courseId }, required: true }],
            where: { student_id: student.id, status: 'active' }
        });
        if (!enrollment) {
            throw { statusCode: 403, message: 'Access denied. You are not enrolled in this course.' };
        }

        const assignment = await Assignment.findByPk(assignmentId, {
            include: [{ model: Module, attributes: ['id', 'name'] }]
        });
        if (!assignment || assignment.course_id !== parseInt(courseId, 10)) {
            throw { statusCode: 404, message: 'Assignment not found or does not belong to this course' };
        }

        const submission = await AssignmentSubmission.findOne({
            where: { student_id: userId, assignment_id: assignmentId, enrollment_id: enrollment.id }
        });

        const batchAssignment = await models.BatchAssignment.findOne({
            where: { batch_id: enrollment.batch_id, assignment_id: assignmentId }
        });

        let uploadedFiles = [];
        let draftContent = null;
        
        if (submission) {
            if (submission.submission_data) {
                draftContent = submission.submission_data.submissionContent || null;
                if (submission.submission_data.attachments && submission.submission_data.attachments.length > 0) {
                    uploadedFiles = submission.submission_data.attachments;
                }
            } else if (submission.file_url) {
                uploadedFiles.push({
                    fileId: 'file_1',
                    fileName: submission.file_url.split('/').pop() || 'uploaded_file',
                    fileUrl: submission.file_url,
                    fileType: 'unknown'
                });
            }
        }

        return {
            assignmentId: String(assignment.id),
            courseId: String(courseId),
            moduleId: assignment.module_id ? String(assignment.module_id) : null,
            assignmentTitle: assignment.title,
            moduleName: assignment.Module ? assignment.Module.name : null,
            description: assignment.description || '',
            dueDate: batchAssignment ? batchAssignment.due_date : null,
            maxMarks: assignment.max_score ? parseFloat(assignment.max_score) : 100,
            draftContent: draftContent,
            uploadedFiles: uploadedFiles
        };
    }

    async submitCourseAssignment(userId, courseId, assignmentId, data) {
        const student = await this._getStudentByUserId(userId);

        const enrollment = await Enrollment.findOne({
            include: [{ model: Batch, where: { course_id: courseId }, required: true }],
            where: { student_id: student.id, status: 'active' }
        });
        
        if (!enrollment) {
            throw { statusCode: 403, message: 'Access denied. You are not enrolled in this course.' };
        }

        const assignment = await Assignment.findByPk(assignmentId);
        if (!assignment || assignment.course_id !== parseInt(courseId, 10)) {
            throw { statusCode: 404, message: 'Assignment not found' };
        }

        const existingSubmission = await AssignmentSubmission.findOne({
            where: { student_id: userId, assignment_id: assignmentId, enrollment_id: enrollment.id }
        });

        if (existingSubmission && existingSubmission.status === 'submitted') {
            throw { statusCode: 400, message: 'Assignment already submitted' };
        }

        let fileUrl = null;
        if (data.attachments && data.attachments.length > 0) {
            fileUrl = data.attachments[0].fileUrl;
        }

        const submissionData = {
            submissionContent: data.submissionContent || null,
            socialLinks: data.socialLinks || [],
            githubLinks: data.githubLinks || [],
            attachments: data.attachments || []
        };

        const isDraft = data.isDraft || false;
        const status = isDraft ? 'pending' : 'submitted';

        let submission;
        if (existingSubmission) {
            submission = await existingSubmission.update({
                file_url: fileUrl || existingSubmission.file_url,
                submission_data: submissionData,
                status: status,
                submitted_at: isDraft ? existingSubmission.submitted_at : (data.submittedAt || new Date())
            });
        } else {
            submission = await AssignmentSubmission.create({
                student_id: userId,
                assignment_id: assignmentId,
                enrollment_id: enrollment.id,
                file_url: fileUrl,
                submission_data: submissionData,
                status: status,
                submitted_at: isDraft ? null : (data.submittedAt || new Date())
            });
        }

        return {
            submissionId: String(submission.id),
            studentId: String(userId),
            assignmentId: String(assignmentId),
            submittedAt: submission.submitted_at,
            status: submission.status
        };
    }

    async getCourseAssignmentResult(userId, courseId, assignmentId) {
        const student = await this._getStudentByUserId(userId);

        const enrollment = await Enrollment.findOne({
            include: [{ model: Batch, where: { course_id: courseId }, required: true }],
            where: { student_id: student.id, status: 'active' }
        });
        
        if (!enrollment) {
            throw { statusCode: 403, message: 'Access denied. You are not enrolled in this course.' };
        }

        const submission = await AssignmentSubmission.findOne({
            where: { student_id: userId, assignment_id: assignmentId, enrollment_id: enrollment.id }
        });

        const assignment = await Assignment.findByPk(assignmentId);

        let uploadedFiles = [];
        let submittedContent = null;
        if (submission) {
            if (submission.submission_data) {
                submittedContent = submission.submission_data.submissionContent || null;
                if (submission.submission_data.attachments && submission.submission_data.attachments.length > 0) {
                    uploadedFiles = submission.submission_data.attachments;
                }
            } else if (submission.file_url) {
                uploadedFiles.push({
                    fileName: submission.file_url.split('/').pop() || 'uploaded_file',
                    fileUrl: submission.file_url,
                    fileType: 'unknown'
                });
            }
        }

        return {
            assignmentId: String(assignmentId),
            studentId: String(userId),
            result: {
                obtainedMarks: submission && submission.grade ? parseFloat(submission.grade) : null,
                totalMarks: assignment && assignment.max_score ? parseFloat(assignment.max_score) : 100,
                passMarks: assignment && assignment.max_score ? parseFloat(assignment.max_score) * 0.4 : 40,
                status: submission ? submission.status : 'pending',
                submittedAt: submission ? submission.submitted_at : null,
                feedback: submission && submission.feedback ? {
                    reviewedBy: "Tutor",
                    comments: submission.feedback,
                    tags: []
                } : null,
                submittedContent: submittedContent,
                submittedFiles: uploadedFiles
            }
        };
    }


    async getAssignmentStats(userId) {
        const student = await this._getStudentByUserId(userId);
        
        const enrollments = await Enrollment.findAll({
            where: { student_id: student.id, status: 'active' },
            include: [{ model: Batch, required: true, attributes: ['course_id'] }]
        });
        
        const courseIds = [...new Set(enrollments.map(e => e.Batch.course_id))];
        
        if (courseIds.length === 0) {
            return {
                total_assignment: 0,
                completed_assignments: 0,
                assignment_completion_percentage: 0
            };
        }
        
        const totalAssignments = await Assignment.count({
            where: { course_id: { [Op.in]: courseIds }, status: 'active' }
        });
        
        const submissions = await AssignmentSubmission.findAll({
            where: {
                student_id: userId,
                status: { [Op.in]: ['submitted', 'graded'] }
            },
            include: [{
                model: Assignment,
                where: { course_id: { [Op.in]: courseIds } },
                required: true
            }]
        });
        
        const completedAssignments = new Set(submissions.map(s => s.assignment_id)).size;
        const completionPercentage = totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0;
        
        return {
            total_assignment: totalAssignments,
            completed_assignments: completedAssignments,
            assignment_completion_percentage: completionPercentage
        };
    }

    async getAssignmentTable(userId, query) {
        const student = await this._getStudentByUserId(userId);
        const { page = 1, limit = 10, search = '', status } = query;
        const offset = (page - 1) * limit;
        
        const enrollments = await Enrollment.findAll({
            where: { student_id: student.id, status: 'active' },
            include: [{ model: Batch, required: true, attributes: ['course_id'] }]
        });
        
        const batchIds = enrollments.map(e => e.batch_id);
        const courseIds = [...new Set(enrollments.map(e => e.Batch.course_id))];
        
        if (courseIds.length === 0) {
            return {
                data: [],
                pagination: { total: 0, page: parseInt(page), limit: parseInt(limit), totalPages: 0 }
            };
        }
        
        const whereClause = { 
            course_id: { [Op.in]: courseIds },
            status: 'active' 
        };
        
        if (search) {
            whereClause.title = { [Op.iLike]: `%${search}%` };
        }
        
        const include = [
            { model: Course, attributes: ['name'] },
            {
                model: AssignmentSubmission,
                where: { student_id: userId },
                required: false
            }
        ];

        if (status === 'pending') {
            const completedSubmissions = await AssignmentSubmission.findAll({
                where: { student_id: userId, status: { [Op.in]: ['submitted', 'graded'] } },
                attributes: ['assignment_id']
            });
            const completedIds = completedSubmissions.map(s => s.assignment_id);
            if (completedIds.length > 0) {
                whereClause.id = { [Op.notIn]: completedIds };
            }
        } else if (status === 'submitted' || status === 'graded') {
            include[1].required = true;
            include[1].where.status = status;
        }
        
        const { count, rows } = await Assignment.findAndCountAll({
            where: whereClause,
            include: include,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']],
            distinct: true
        });
        
        const batchAssignments = await models.BatchAssignment.findAll({
            where: { batch_id: { [Op.in]: batchIds } }
        });
        const dueDateMap = {};
        batchAssignments.forEach(ba => {
            dueDateMap[ba.assignment_id] = ba.due_date;
        });
        
        const data = rows.map(r => {
            const submission = r.AssignmentSubmissions && r.AssignmentSubmissions[0];
            let currentStatus = 'pending';
            if (submission) {
                currentStatus = submission.status;
            }
            
            return {
                assignment_id: r.id,
                assignment_name: r.title,
                course: r.Course ? r.Course.name : 'N/A',
                due_date: dueDateMap[r.id] || null,
                status: currentStatus
            };
        });
        
        return {
            data,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(count / limit)
            }
        };
    }
}

module.exports = new StudentPortalService();
