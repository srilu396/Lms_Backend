const { Course, Module, Topic, Lesson, StudentProgress, LessonProgress, Assignment, Quiz, MediaAttachment, Domain, sequelize } = require('../models');
const { Op } = require('sequelize');
const { handleContentSync, prepareEntityDbData, mediaInclude, serializeWithMedia } = require('../utils/media');

function mapQuizIdsToQuizzes(obj, isRoot = false) {
    if (obj && typeof obj === 'object') {
        if (!isRoot && obj.quiz_ids !== undefined && obj.quizzes === undefined) {
            obj.quizzes = obj.quiz_ids;
        }
        if (Array.isArray(obj.modules)) {
            obj.modules.forEach(m => mapQuizIdsToQuizzes(m, false));
        }
        if (Array.isArray(obj.lessons)) {
            obj.lessons.forEach(l => mapQuizIdsToQuizzes(l, false));
        }
    }
}

function reorderLesson(lesson) {
    if (!lesson || typeof lesson !== 'object') return lesson;
    const excludeKeys = ['topics', 'quizzes', 'assignments'];
    const reordered = {};
    Object.keys(lesson).forEach(key => {
        if (!excludeKeys.includes(key)) {
            reordered[key] = lesson[key];
        }
    });
    reordered.topics = Array.isArray(lesson.topics) ? [...lesson.topics] : [];
    reordered.quizzes = Array.isArray(lesson.quizzes) ? [...lesson.quizzes] : [];
    reordered.assignments = Array.isArray(lesson.assignments) ? [...lesson.assignments] : [];
    return reordered;
}

function reorderModule(module) {
    if (!module || typeof module !== 'object') return module;
    const excludeKeys = ['lessons', 'quizzes', 'assignments'];
    const reordered = {};
    Object.keys(module).forEach(key => {
        if (!excludeKeys.includes(key)) {
            reordered[key] = module[key];
        }
    });
    reordered.lessons = Array.isArray(module.lessons)
        ? module.lessons.map(reorderLesson)
        : [];
    reordered.quizzes = Array.isArray(module.quizzes)
        ? [...module.quizzes]
        : [];
    reordered.assignments = Array.isArray(module.assignments)
        ? [...module.assignments]
        : [];
    return reordered;
}

function reorderCourse(course) {
    if (!course || typeof course !== 'object') return course;
    const excludeKeys = ['modules', 'assignments', 'stats'];
    const reordered = {};
    Object.keys(course).forEach(key => {
        if (!excludeKeys.includes(key)) {
            reordered[key] = course[key];
        }
    });
    reordered.modules = Array.isArray(course.modules)
        ? course.modules.map(reorderModule)
        : [];
    reordered.assignments = Array.isArray(course.assignments)
        ? [...course.assignments]
        : [];
    if ('stats' in course) {
        reordered.stats = course.stats;
    }
    return reordered;
}

function summarizeAssessments(items, type) {
    if (!Array.isArray(items)) return [];
    return items.map(item => {
        const summary = { id: item.id };
        if (type === 'assignment') {
            summary.title = item.title || item.name || null;
            if (item.status !== undefined) summary.status = item.status;
        } else {
            summary.name = item.name || item.title || null;
            if (item.status !== undefined) summary.status = item.status;
        }
        return summary;
    });
}

function buildCourseMetadataPayload(courseData) {
    const source = courseData && typeof courseData === 'object' ? courseData : {};
    const payload = {};
    const excludedKeys = new Set([
        'modules',
        'assignments',
        'stats',
        'quizzes',
        'lessons',
        'topics',
        'content_blocks',
        'images',
        'videos',
        'pdfs',
        'urls',
        'attachments',
        'media_attachments'
    ]);

    Object.entries(source).forEach(([key, value]) => {
        if (excludedKeys.has(key)) return;
        if (key === 'tags') {
            payload[key] = Array.isArray(value) ? value : [];
            return;
        }
        if (key === 'final_assessment') {
            payload[key] = value;
            return;
        }
        if (Array.isArray(value) || (value && typeof value === 'object')) return;
        payload[key] = value;
    });

    return payload;
}

function sanitizeCoursePayload(data = {}) {
    const courseData = JSON.parse(JSON.stringify(data || {}));
    if (courseData.status === 'published') {
        courseData.status = 'active';
    }

    const legacyFinalAssessmentId = courseData.final_assessment_id ?? (
        Array.isArray(courseData.assignment_ids) && courseData.assignment_ids.length > 0
            ? courseData.assignment_ids[0]
            : Array.isArray(courseData.quiz_ids) && courseData.quiz_ids.length > 0
                ? courseData.quiz_ids[0]
                : null
    );

    const legacyFinalAssessmentType = courseData.final_assessment_type ?? (
        Array.isArray(courseData.assignment_ids) && courseData.assignment_ids.length > 0
            ? 'assignment'
            : Array.isArray(courseData.quiz_ids) && courseData.quiz_ids.length > 0
                ? 'quiz'
                : null
    );

    const sanitized = {};
    const allowedFields = [
        'name',
        'description',
        'thumbnail_url',
        'domain_id',
        'institution_id',
        'status',
        'unique_code',
        'tags'
    ];

    allowedFields.forEach((field) => {
        if (courseData[field] !== undefined) {
            sanitized[field] = courseData[field];
        }
    });

    // Normalize domain or domain_id payload into canonical domain_id
    const rawDomain = courseData.domain_id !== undefined ? courseData.domain_id : courseData.domain;
    if (rawDomain !== undefined) {
        if (rawDomain === null || rawDomain === '') {
            sanitized.domain_id = null;
        } else if (typeof rawDomain === 'object' && rawDomain !== null) {
            const parsedId = parseInt(rawDomain.id, 10);
            sanitized.domain_id = isNaN(parsedId) ? null : parsedId;
        } else {
            const parsedId = parseInt(rawDomain, 10);
            sanitized.domain_id = isNaN(parsedId) ? null : parsedId;
        }
    }

    if (courseData.final_assessment_id !== undefined || legacyFinalAssessmentId !== null) {
        sanitized.final_assessment_id = courseData.final_assessment_id ?? legacyFinalAssessmentId;
    }

    if (courseData.final_assessment_type !== undefined || legacyFinalAssessmentType !== null) {
        sanitized.final_assessment_type = courseData.final_assessment_type ?? legacyFinalAssessmentType;
    }

    // Normalize tags
    if (sanitized.tags === undefined || sanitized.tags === null) {
        sanitized.tags = [];
    } else if (!Array.isArray(sanitized.tags)) {
        sanitized.tags = [sanitized.tags];
    } else {
        sanitized.tags = sanitized.tags.filter(tag => tag !== null && tag !== undefined && tag !== '');
    }

    return sanitized;
}

function buildCurriculumSidebarPayload(courseData) {
    const source = courseData && typeof courseData === 'object' ? courseData : {};
    const payload = {
        id: source.id,
        name: source.name,
        status: source.status,
        thumbnail_url: source.thumbnail_url || null,
        modules: []
    };

    const finalAssessment = source.final_assessment_id
        ? {
            id: source.final_assessment_id,
            title: source.final_assessment_title || null,
            type: source.final_assessment_type || null,
            order_num: source.final_assessment_order_num || 9999,
            unique_code: source.final_assessment_unique_code || null
        }
        : null;

    const modules = Array.isArray(source.modules) ? source.modules : [];
    payload.modules = modules.map(module => {
        const moduleSummary = {
            id: module.id,
            name: module.name,
            order_num: module.order_num,
            is_locked: module.is_locked !== undefined ? module.is_locked : false,
            total_lessons_count: 0,
            completed_lessons_count: 0,
            assignments: summarizeAssessments(module.assignments, 'assignment'),
            quizzes: summarizeAssessments(module.quizzes, 'quiz')
        };

        const lessons = Array.isArray(module.lessons) ? module.lessons : [];
        moduleSummary.lessons = lessons.map(lesson => ({
            id: lesson.id,
            name: lesson.name,
            type: lesson.type || null,
            order_num: lesson.order_num,
            duration_minutes: lesson.duration_minutes || null,
            assignments: summarizeAssessments(lesson.assignments, 'assignment'),
            quizzes: summarizeAssessments(lesson.quizzes, 'quiz'),
            topics: Array.isArray(lesson.topics)
                ? lesson.topics.map(topic => ({
                    id: topic.id,
                    name: topic.name,
                    order_num: topic.order_num
                }))
                : []
        }));

        moduleSummary.total_lessons_count = moduleSummary.lessons.length;
        return moduleSummary;
    });

    if (finalAssessment) {
        payload.final_assessment = finalAssessment;
    }

    return payload;
}

class CourseService {
    async createCourse(data) {
        return await sequelize.transaction(async (transaction) => {
            const courseData = sanitizeCoursePayload(data);
            if (courseData.domain_id) {
                const domainExists = await Domain.findByPk(courseData.domain_id, { transaction });
                if (!domainExists) {
                    const error = new Error(`Domain with id ${courseData.domain_id} not found`);
                    error.statusCode = 400;
                    throw error;
                }
            }
            const course = await Course.create(courseData, { transaction });
            return await this.getCourseById(course.id, transaction, { includeHierarchy: false });
        });
    }

    async getCourses(query = {}) {
        const { search, status, institution_id, domain_id, domain, page = 1, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const where = {};

        if (status) {
            where.status = status === 'published' ? 'active' : status;
        }

        if (institution_id) {
            where.institution_id = institution_id;
        }

        const activeDomainId = domain_id || domain;
        if (activeDomainId) {
            where.domain_id = activeDomainId;
        }

        if (search) {
            where.name = { [Op.iLike]: `%${search.trim()}%` };
        }

        const { count, rows } = await Course.findAndCountAll({
            where,
            include: [
                {
                    model: Domain,
                    as: 'domain',
                    attributes: ['id', 'name']
                }
            ],
            attributes: [
                'id',
                'name',
                'description',
                'status',
                'unique_code',
                'updated_at',
                [
                    sequelize.literal(`(
                        SELECT COUNT(*)
                        FROM "modules"
                        WHERE "modules"."course_id" = "Course"."id"
                    )`),
                    'no_of_modules'
                ]
            ],
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
        const stats = await Course.findAll({
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['status'],
            raw: true
        });

        let total = 0;
        let active = 0;
        let draft = 0;

        stats.forEach(item => {
            const count = parseInt(item.count, 10) || 0;
            total += count;
            if (item.status === 'active') {
                active = count;
            } else if (item.status === 'draft') {
                draft = count;
            }
        });

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
            if (Array.isArray(url)) return url.map(u => fixUrl(u));
            if (url.startsWith('blob:')) url = url.replace(/^blob:/, '');
            if (url.startsWith('http')) return url;
            const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
            return `${baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
        };

        const fixBlocks = (blocks) => {
            if (!blocks || !Array.isArray(blocks)) return;
            blocks.forEach(block => {
                if (block.type !== 'text' && block.value) {
                    block.value = fixUrl(block.value);
                }
            });
        };

        if (item.thumbnail_url) item.thumbnail_url = fixUrl(item.thumbnail_url);
        if (item.images) item.images = fixUrl(item.images);
        if (item.videos) item.videos = fixUrl(item.videos);
        if (item.content_blocks) fixBlocks(item.content_blocks);

        const modules = Array.isArray(item.modules) ? item.modules : [];
        modules.forEach(m => {
            if (m.images) m.images = fixUrl(m.images);
            if (m.videos) m.videos = fixUrl(m.videos);
            if (m.pdfs) m.pdfs = fixUrl(m.pdfs);
            if (m.content_blocks) fixBlocks(m.content_blocks);
            const lessons = Array.isArray(m.lessons) ? m.lessons : [];
            lessons.forEach(l => {
                if (l.images) l.images = fixUrl(l.images);
                if (l.videos) l.videos = fixUrl(l.videos);
                if (l.pdfs) l.pdfs = fixUrl(l.pdfs);
                if (l.content_blocks) fixBlocks(l.content_blocks);
                const topics = Array.isArray(l.topics) ? l.topics : [];
                topics.forEach(t => {
                    if (t.images) t.images = fixUrl(t.images);
                    if (t.videos) t.videos = fixUrl(t.videos);
                    if (t.pdfs) t.pdfs = fixUrl(t.pdfs);
                    if (t.content_blocks) fixBlocks(t.content_blocks);
                });
            });
        });
    }

    async getCourseById(id, transaction = null, options = {}) {
        const { includeHierarchy = false } = options;
        const course = await Course.findByPk(id, {
            include: [
                {
                    model: Domain,
                    as: 'domain',
                    attributes: ['id', 'name']
                },
                {
                    model: Assignment,
                    as: 'final_assignment',
                    required: false
                },
                {
                    model: Quiz,
                    as: 'final_quiz',
                    required: false
                },
                ...(includeHierarchy ? [
                    { 
                        model: Assignment, 
                        as: 'assignments',
                        where: {
                            course_id: id,
                            module_id: null,
                            lesson_id: null
                        },
                        required: false
                    },
                    {
                        model: Module,
                        as: 'modules',
                        include: [
                            { model: Assignment, as: 'assignments', where: { lesson_id: null }, required: false },
                            { model: Quiz, as: 'quizzes', where: { lesson_id: null }, required: false },
                            mediaInclude(),
                            {
                                model: Lesson,
                                as: 'lessons',
                                include: [
                                    { model: Assignment, as: 'assignments' },
                                    { model: Quiz, as: 'quizzes' },
                                    mediaInclude(),
                                    { 
                                        model: Topic, 
                                        as: 'topics',
                                        include: [mediaInclude()]
                                    }
                                ]
                            }
                        ]
                    }
                ] : [])
            ],
            order: includeHierarchy ? [
                [{ model: Module, as: 'modules' }, 'order_num', 'ASC'],
                [{ model: Module, as: 'modules' }, { model: Lesson, as: 'lessons' }, 'order_num', 'ASC'],
                [{ model: Module, as: 'modules' }, { model: Lesson, as: 'lessons' }, { model: Topic, as: 'topics' }, 'order_num', 'ASC']
            ] : undefined,
            transaction
        });
        if (!course) {
            const error = new Error('Course not found');
            error.statusCode = 404;
            throw error;
        }

        const courseJson = course.toJSON();

        // Attach final_assessment based on final_assessment_type
        if (courseJson.final_assessment_id) {
            if (courseJson.final_assessment_type === 'assignment' && courseJson.final_assignment) {
                courseJson.final_assessment = courseJson.final_assignment;
            } else if (courseJson.final_assessment_type === 'quiz' && courseJson.final_quiz) {
                courseJson.final_assessment = courseJson.final_quiz;
            }
        }

        // Clean up the extra includes
        delete courseJson.final_assignment;
        delete courseJson.final_quiz;

        if (!includeHierarchy) {
            const metadata = buildCourseMetadataPayload(courseJson);
            if (courseJson.domain) {
                metadata.domain = courseJson.domain;
                if (courseJson.domain.name) {
                    metadata.domain_name = courseJson.domain.name;
                }
            }
            if (courseJson.final_assessment) {
                metadata.final_assessment = courseJson.final_assessment;
            }
            this.formatMediaUrls(metadata);
            return metadata;
        }

        // Calculate totals for stats
        const modules = Array.isArray(courseJson.modules) ? courseJson.modules : [];
        let totalModules = modules.length;
        let totalLessons = 0;
        let totalTopics = 0;
        let totalDuration = 0;

        modules.forEach(m => {
            const lessons = Array.isArray(m.lessons) ? m.lessons : [];
            totalLessons += lessons.length;
            lessons.forEach(l => {
                totalDuration += (l.duration_minutes || 0);
                const topics = Array.isArray(l.topics) ? l.topics : [];
                totalTopics += topics.length;
            });
        });

        courseJson.no_of_modules = totalModules;
        courseJson.total_lessons = totalLessons;
        courseJson.total_topics = totalTopics;

        // Serialize media into grouped arrays for each entity
        courseJson.modules = modules.map(m => {
            const mod = serializeWithMedia(m);
            const lessons = Array.isArray(mod.lessons) ? mod.lessons : [];
            mod.lessons = lessons.map(l => {
                const les = serializeWithMedia(l);
                const topics = Array.isArray(les.topics) ? les.topics : [];
                les.topics = topics.map(t => serializeWithMedia(t));
                return les;
            });
            return mod;
        });

        this.formatMediaUrls(courseJson);

        const courseWithStats = {
            ...courseJson,
            stats: {
                no_of_modules: totalModules,
                total_lessons: totalLessons,
                total_topics: totalTopics,
                total_duration_minutes: totalDuration
            }
        };
        return reorderCourse(courseWithStats);
    }

    async updateCourse(id, data) {
        const course = await Course.findByPk(id);
        if (!course) {
            const error = new Error('Course not found');
            error.statusCode = 404;
            throw error;
        }

        await sequelize.transaction(async (transaction) => {
            const courseData = sanitizeCoursePayload(data);
            if (courseData.domain_id) {
                const domainExists = await Domain.findByPk(courseData.domain_id, { transaction });
                if (!domainExists) {
                    const error = new Error(`Domain with id ${courseData.domain_id} not found`);
                    error.statusCode = 400;
                    throw error;
                }
            }
            await course.update(courseData, { transaction });
        });

        return await this.getCourseById(course.id, null, { includeHierarchy: false });
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
        const course = await Course.findByPk(courseId, {
            include: [
                { 
                    model: Assignment, 
                    as: 'assignments',
                    where: {
                        course_id: courseId,
                        module_id: null,
                        lesson_id: null
                    },
                    required: false
                },
                {
                    model: Module,
                    as: 'modules',
                    include: [
                        { model: Assignment, as: 'assignments', where: { lesson_id: null }, required: false },
                        { model: Quiz, as: 'quizzes', where: { lesson_id: null }, required: false },
                        {
                            model: Lesson,
                            as: 'lessons',
                            include: [
                                { model: Assignment, as: 'assignments' },
                                { model: Quiz, as: 'quizzes' },
                                { 
                                    model: Topic, 
                                    as: 'topics'
                                }
                            ]
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

        if (!course) {
            const error = new Error('Course not found');
            error.statusCode = 404;
            throw error;
        }

        const courseJson = course.toJSON();
        const finalAssessmentId = course.final_assessment_id || courseJson.final_assessment_id;
        const finalAssessmentType = course.final_assessment_type || courseJson.final_assessment_type;

        let finalAssessmentTitle = null;
        let finalAssessmentUniqueCode = null;

        if (finalAssessmentId) {
            if (finalAssessmentType === 'quiz') {
                const quiz = await Quiz.findByPk(finalAssessmentId, {
                    attributes: ['id', 'name', 'status', 'unique_code']
                });
                if (quiz) {
                    finalAssessmentTitle = quiz.name;
                    finalAssessmentUniqueCode = quiz.unique_code || null;
                }
            } else {
                const assignment = await Assignment.findByPk(finalAssessmentId, {
                    attributes: ['id', 'title', 'status']
                });
                if (assignment) {
                    finalAssessmentTitle = assignment.title;
                }
            }
        }

        const sidebarPayload = buildCurriculumSidebarPayload({
            ...courseJson,
            final_assessment_id: finalAssessmentId,
            final_assessment_title: finalAssessmentTitle,
            final_assessment_type: finalAssessmentType,
            final_assessment_order_num: 9999,
            final_assessment_unique_code: finalAssessmentUniqueCode
        });

        let progressRecords = [];
        let lessonProgressRecords = [];
        if (studentId && enrollmentId) {
            progressRecords = await StudentProgress.findAll({
                where: { student_id: studentId, enrollment_id: enrollmentId }
            });
            lessonProgressRecords = await LessonProgress.findAll({
                where: { student_id: studentId, enrollment_id: enrollmentId }
            });
        }

        for (let i = 0; i < sidebarPayload.modules.length; i++) {
            const mod = sidebarPayload.modules[i];
            
            let totalLessonsCount = 0;
            let completedLessonsCount = 0;
            
            const lessons = Array.isArray(mod.lessons) ? mod.lessons : [];
            totalLessonsCount = lessons.length;
            lessons.forEach(l => {
                const progress = lessonProgressRecords.find(p => p.lesson_id === l.id && p.is_completed);
                if (progress) completedLessonsCount++; 
            });

            mod.total_lessons_count = totalLessonsCount;
            mod.completed_lessons_count = completedLessonsCount;

            if (studentId && enrollmentId) {
                if (mod.order_num === 1) {
                    mod.is_locked = false;
                } else {
                    const prevMod = sidebarPayload.modules.find(m => m.order_num === mod.order_num - 1);
                    if (!prevMod) {
                        mod.is_locked = false;
                    } else {
                        const prevModProgress = progressRecords.find(p => p.module_id === prevMod.id && p.is_completed);
                        mod.is_locked = !prevModProgress;
                    }
                }
            } else {
                mod.is_locked = false;
            }
        }

        this.formatMediaUrls(sidebarPayload);

        return sidebarPayload;
    }
}

module.exports = new CourseService();
module.exports.buildCourseMetadataPayload = buildCourseMetadataPayload;
module.exports.buildCurriculumSidebarPayload = buildCurriculumSidebarPayload;
