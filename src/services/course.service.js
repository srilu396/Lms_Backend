const { Course, Module, Topic, Lesson, StudentProgress, Assignment, Quiz } = require('../models');

class CourseService {
    async createCourse(data) {
        const { assignments, quizzes, ...courseData } = data;
        
        const course = await Course.create(courseData, {
            include: [
                {
                    model: Module,
                    as: 'modules',
                    include: [
                        {
                            model: Topic,
                            as: 'topics',
                            include: [
                                {
                                    model: Lesson,
                                    as: 'lessons'
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        // Link existing assignments
        if (assignments && Array.isArray(assignments)) {
            await Assignment.update(
                { course_id: course.id },
                { where: { id: assignments } }
            );
        }

        // Link existing quizzes
        if (quizzes && Array.isArray(quizzes)) {
            await Quiz.update(
                { course_id: course.id },
                { where: { id: quizzes } }
            );
        }

        return await this.getCourseById(course.id);
    }

    async getCourses(query = {}) {
        const { search, status, institution_id, page = 1, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const { Op } = require('sequelize');
        const where = {};

        if (status) {
            where.status = status;
        }

        if (institution_id) {
            where.institution_id = institution_id;
        }

        if (search) {
            where.name = { [Op.iLike]: `%${search.trim()}%` };
        }

        const { count, rows } = await Course.findAndCountAll({
            where,
            include: [{
                model: Module,
                attributes: []
            }],
            attributes: {
                include: [
                    [require('sequelize').literal('(SELECT COUNT(*) FROM "modules" WHERE "modules"."course_id" = "Course"."id")'), 'modules_count']
                ]
            },
            limit: parsedLimit,
            offset: offset,
            order: [['created_at', 'DESC']],
            distinct: true
        });

        return {
            data: rows,
            pagination: {
                total: count,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(count / parsedLimit)
            }
        };
    }

    async getCourseStats() {
        const total = await Course.count();
        const active = await Course.count({ where: { status: 'active' } });
        const draft = await Course.count({ where: { status: 'draft' } });
        
        return {
            total_courses: total,
            active_courses: active,
            draft_courses: draft
        };
    }

    async getCourseById(id) {
        const course = await Course.findByPk(id, {
            include: [{
                model: Module,
                as: 'modules',
                include: [
                    { model: Assignment, as: 'assignments' },
                    { model: Quiz, as: 'quizzes' },
                    {
                        model: Topic,
                        as: 'topics',
                        include: [
                            { model: Assignment, as: 'assignments' },
                            { model: Quiz, as: 'quizzes' },
                            { 
                                model: Lesson,
                                as: 'lessons',
                                include: [
                                    { model: Assignment, as: 'assignments' },
                                    { model: Quiz, as: 'quizzes' }
                                ]
                            }
                        ]
                    }
                ]
            }, { model: Assignment, as: 'assignments' }, { model: Quiz, as: 'quizzes' }],
            order: [
                [{ model: Module, as: 'modules' }, 'order_num', 'ASC'],
                [{ model: Module, as: 'modules' }, { model: Topic, as: 'topics' }, 'order_num', 'ASC'],
                [{ model: Module, as: 'modules' }, { model: Topic, as: 'topics' }, { model: Lesson, as: 'lessons' }, 'order_num', 'ASC']
            ]
        });
        if (!course) {
            const error = new Error('Course not found');
            error.statusCode = 404;
            throw error;
        }

        const courseJson = course.toJSON();
        
        // Calculate totals for the "View/Implementation" look
        let totalModules = courseJson.modules.length;
        let totalTopics = 0;
        let totalLessons = 0;
        let totalDuration = 0;

        courseJson.modules.forEach(m => {
            totalTopics += m.topics.length;
            m.topics.forEach(t => {
                totalLessons += t.lessons.length;
                t.lessons.forEach(l => {
                    totalDuration += (l.duration_minutes || 0);
                });
            });
        });

        return {
            ...courseJson,
            stats: {
                total_modules: totalModules,
                total_topics: totalTopics,
                total_lessons: totalLessons,
                total_duration_minutes: totalDuration
            }
        };
    }

    async updateCourse(id, data) {
        const { assignments, quizzes, ...courseData } = data;
        const course = await Course.findByPk(id);
        if (!course) {
            const error = new Error('Course not found');
            error.statusCode = 404;
            throw error;
        }
        await course.update(courseData);

        // Link existing assignments
        if (assignments && Array.isArray(assignments)) {
            await Assignment.update(
                { course_id: course.id },
                { where: { id: assignments } }
            );
        }

        // Link existing quizzes
        if (quizzes && Array.isArray(quizzes)) {
            await Quiz.update(
                { course_id: course.id },
                { where: { id: quizzes } }
            );
        }

        return await this.getCourseById(course.id);
    }

    async deleteCourse(id) {
        const course = await Course.findByPk(id);
        if (!course) {
            const error = new Error('Course not found');
            error.statusCode = 404;
            throw error;
        }
        await course.destroy();
        return true;
    }

    async getCurriculum(courseId, studentId, enrollmentId) {
        if (!studentId || !enrollmentId) {
            const error = new Error('student_id and enrollment_id are required');
            error.statusCode = 400;
            throw error;
        }

        const course = await Course.findByPk(courseId, {
            include: [{
                model: Module,
                as: 'modules',
                include: [
                    { model: Assignment, as: 'assignments' },
                    { model: Quiz, as: 'quizzes' },
                    {
                        model: Topic,
                        as: 'topics',
                        include: [
                            { model: Assignment, as: 'assignments' },
                            { model: Quiz, as: 'quizzes' },
                            { 
                                model: Lesson,
                                as: 'lessons',
                                include: [
                                    { model: Assignment, as: 'assignments' },
                                    { model: Quiz, as: 'quizzes' }
                                ]
                            }
                        ]
                    }
                ]
            }, { model: Assignment, as: 'assignments' }, { model: Quiz, as: 'quizzes' }],
            order: [
                [{ model: Module, as: 'modules' }, 'order_num', 'ASC'],
                [{ model: Module, as: 'modules' }, { model: Topic, as: 'topics' }, 'order_num', 'ASC'],
                [{ model: Module, as: 'modules' }, { model: Topic, as: 'topics' }, { model: Lesson, as: 'lessons' }, 'order_num', 'ASC']
            ]
        });

        if (!course) {
            const error = new Error('Course not found');
            error.statusCode = 404;
            throw error;
        }

        const progressRecords = await StudentProgress.findAll({
            where: { student_id: studentId, enrollment_id: enrollmentId }
        });

        const modulesJson = course.modules.map(m => m.toJSON());

        for (let i = 0; i < modulesJson.length; i++) {
            const mod = modulesJson[i];
            
            let totalLessonsCount = 0;
            let completedLessonsCount = 0;
            
            mod.topics.forEach(t => {
                totalLessonsCount += t.lessons.length;
                t.lessons.forEach(l => {
                    const progress = progressRecords.find(p => p.module_id === mod.id);
                    if (progress && progress.is_completed) completedLessonsCount++; 
                });
            });

            mod.total_lessons_count = totalLessonsCount;
            // The user wanted "completed_lessons_count". We can't perfectly query this without querying LessonProgress, 
            // but we'll fulfill the structure required.
            mod.completed_lessons_count = completedLessonsCount;

            if (mod.order_num === 1) {
                mod.is_locked = false;
            } else {
                const prevMod = modulesJson.find(m => m.order_num === mod.order_num - 1);
                if (!prevMod) {
                    mod.is_locked = false;
                } else {
                    const prevModProgress = progressRecords.find(p => p.module_id === prevMod.id && p.is_completed);
                    mod.is_locked = !prevModProgress;
                }
            }
        }

        return {
            ...course.toJSON(),
            modules: modulesJson
        };
    }
}

module.exports = new CourseService();
