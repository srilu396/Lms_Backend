const { Course, Module, Topic, Lesson, StudentProgress, Assignment, Quiz, sequelize } = require('../models');
const { Op } = require('sequelize');

class CourseService {
    async createCourse(data) {
        const { ...courseData } = data;
        
        const course = await Course.create(courseData, {
            include: [
                { model: Assignment, as: 'assignments' },
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
                                    as: 'lessons',
                                    include: [
                                        { model: Assignment, as: 'assignments' },
                                        { model: Quiz, as: 'quizzes' }
                                    ]
                                }
                            ]
                        },
                        { model: Assignment, as: 'assignments' }
                    ]
                }
            ]
        });

        return await this.getCourseById(course.id);
    }

    async getCourses(query = {}) {
        const { search, status, institution_id, page = 1, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

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
            attributes: {
                include: [
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM "modules"
                            WHERE "modules"."course_id" = "Course"."id"
                        )`),
                        'no_of_modules'
                    ],
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM "topics" t
                            WHERE t."module_id" IN (
                                SELECT id FROM "modules" WHERE "course_id" = "Course"."id"
                            )
                        )`),
                        'total_topics'
                    ],
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM "lessons" l
                            WHERE l."topic_id" IN (
                                SELECT id FROM "topics" WHERE "module_id" IN (SELECT id FROM "modules" WHERE "course_id" = "Course"."id")
                            )
                        )`),
                        'total_lessons'
                    ]
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

    async getCourseLookup(query = {}) {
        const { search, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);

        const where = {
            status: 'active'
        };

        if (search) {
            where.name = { [Op.iLike]: `%${search.trim()}%` };
        }

        const rows = await Course.findAll({
            where,
            limit: parsedLimit,
            attributes: ['id', 'name'],
            order: [['name', 'ASC']]
        });

        return {
            data: rows
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

    formatMediaUrls(item) {
        if (!item) return;
        const fixUrl = (url) => {
            if (!url) return url;
            if (url.startsWith('blod:')) url = url.replace(/^blod:/, '');
            if (url.startsWith('http')) return url;
            const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
            return `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
        };

        if (item.thumbnail_url) item.thumbnail_url = fixUrl(item.thumbnail_url);
        if (item.image_url) item.image_url = fixUrl(item.image_url);
        if (item.video_url) item.video_url = fixUrl(item.video_url);

        if (item.modules) {
            item.modules.forEach(m => {
                if (m.image_url) m.image_url = fixUrl(m.image_url);
                if (m.video_url) m.video_url = fixUrl(m.video_url);
                if (m.topics) {
                    m.topics.forEach(t => {
                        if (t.image_url) t.image_url = fixUrl(t.image_url);
                        if (t.video_url) t.video_url = fixUrl(t.video_url);
                        if (t.lessons) {
                            t.lessons.forEach(l => {
                                if (l.image_url) l.image_url = fixUrl(l.image_url);
                                if (l.video_url) l.video_url = fixUrl(l.video_url);
                            });
                        }
                    });
                }
            });
        }
    }

    async getCourseById(id) {
        const course = await Course.findByPk(id, {
            include: [
                { model: Assignment, as: 'assignments' },
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
                                    as: 'lessons',
                                    include: [
                                        { model: Assignment, as: 'assignments' },
                                        { model: Quiz, as: 'quizzes' }
                                    ]
                                }
                            ]
                        },
                        { model: Assignment, as: 'assignments' }
                    ]
                }
            ],
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

        // Calculate totals for stats
        let totalModules = courseJson.modules.length;
        let totalTopics = 0;
        let totalLessons = 0;
        let totalDuration = 0;

        courseJson.modules.forEach(m => {
            totalTopics += (m.topics ? m.topics.length : 0);
            if (m.topics) {
                m.topics.forEach(t => {
                    totalLessons += (t.lessons ? t.lessons.length : 0);
                    if (t.lessons) {
                        t.lessons.forEach(l => {
                            totalDuration += (l.duration_minutes || 0);
                        });
                    }
                });
            }
        });

        courseJson.no_of_modules = totalModules;
        courseJson.total_topics = totalTopics;
        courseJson.total_lessons = totalLessons;

        this.formatMediaUrls(courseJson);

        return {
            ...courseJson,
            stats: {
                no_of_modules: totalModules,
                total_topics: totalTopics,
                total_lessons: totalLessons,
                total_duration_minutes: totalDuration
            }
        };
    }

    async updateCourse(id, data) {
        const { ...courseData } = data;
        const course = await Course.findByPk(id);
        if (!course) {
            const error = new Error('Course not found');
            error.statusCode = 404;
            throw error;
        }
        await course.update(courseData);

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
            include: [
                { model: Assignment, as: 'assignments' },
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
                                    as: 'lessons',
                                    include: [
                                        { model: Assignment, as: 'assignments' },
                                        { model: Quiz, as: 'quizzes' }
                                    ]
                                }
                            ]
                        },
                        { model: Assignment, as: 'assignments' }
                    ]
                }
            ],
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

        const progressRecords = await StudentProgress.findAll({
            where: { student_id: studentId, enrollment_id: enrollmentId }
        });

        const modulesJson = courseJson.modules.map(m => m);

        for (let i = 0; i < modulesJson.length; i++) {
            const mod = modulesJson[i];
            
            let totalLessonsCount = 0;
            let completedLessonsCount = 0;
            
            if (mod.topics) {
                mod.topics.forEach(t => {
                    if (t.lessons) {
                        totalLessonsCount += t.lessons.length;
                        t.lessons.forEach(l => {
                            const progress = progressRecords.find(p => p.module_id === mod.id);
                            if (progress && progress.is_completed) completedLessonsCount++; 
                        });
                    }
                });
            }

            mod.total_lessons_count = totalLessonsCount;
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

        this.formatMediaUrls(courseJson);

        return {
            ...courseJson,
            modules: modulesJson
        };
    }
}

module.exports = new CourseService();
