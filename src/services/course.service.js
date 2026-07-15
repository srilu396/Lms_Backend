const { Course, Module, Topic, Lesson, StudentProgress, LessonProgress, Assignment, Quiz, MediaAttachment, sequelize } = require('../models');
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

class CourseService {
    async createCourse(data) {
        return await sequelize.transaction(async (transaction) => {
            const courseData = JSON.parse(JSON.stringify(data));
            mapQuizIdsToQuizzes(courseData, true);
            
            // Handle mapped status 'published' -> 'active'
            if (courseData.status === 'published') {
                courseData.status = 'active';
            }

            const courseAssignmentIds = courseData.assignment_ids || [];
            delete courseData.assignment_ids;
            delete courseData.quizzes;
            delete courseData.quiz_ids;

            if (courseData.modules) {
                courseData.modules.forEach(m => {
                    const cleanM = prepareEntityDbData(m);
                    Object.assign(m, cleanM);
                    delete m.assignment_ids;
                    delete m.quizzes;

                    if (m.lessons) {
                        m.lessons.forEach(l => {
                            const cleanL = prepareEntityDbData(l);
                            Object.assign(l, cleanL);
                            delete l.assignment_ids;
                            delete l.quizzes;

                            if (l.topics) {
                                l.topics.forEach(t => {
                                    const cleanT = prepareEntityDbData(t);
                                    Object.assign(t, cleanT);
                                    delete t.assignment_ids;
                                    delete t.quizzes;
                                });
                            }
                        });
                    }
                });
            }

            const course = await Course.create(courseData, {
                include: [
                    {
                        model: Module,
                        as: 'modules',
                        include: [
                            {
                                model: Lesson,
                                as: 'lessons',
                                include: [
                                    { 
                                        model: Topic, 
                                        as: 'topics'
                                    }
                                ]
                            }
                        ]
                    }
                ],
                transaction
            });

            if (courseAssignmentIds.length > 0) {
                await Assignment.update({ course_id: course.id }, { where: { id: courseAssignmentIds }, transaction });
            }

            if (data.modules && course.modules) {
                for (let mIdx = 0; mIdx < data.modules.length; mIdx++) {
                    const origModule = data.modules[mIdx];
                    const createdModule = course.modules[mIdx];

                    if (origModule.assignment_ids && origModule.assignment_ids.length > 0) {
                        await Assignment.update({ module_id: createdModule.id, course_id: course.id }, { where: { id: origModule.assignment_ids }, transaction });
                    }
                    if (origModule.quizzes && origModule.quizzes.length > 0) {
                        await Quiz.update({ module_id: createdModule.id, course_id: course.id }, { where: { id: origModule.quizzes }, transaction });
                    }

                    // Sync module content blocks / media attachments
                    await handleContentSync('module', createdModule.id, origModule, transaction);

                    if (origModule.lessons && createdModule.lessons) {
                        for (let lIdx = 0; lIdx < origModule.lessons.length; lIdx++) {
                            const origLesson = origModule.lessons[lIdx];
                            const createdLesson = createdModule.lessons[lIdx];

                            if (origLesson.assignment_ids && origLesson.assignment_ids.length > 0) {
                                await Assignment.update({ lesson_id: createdLesson.id, module_id: createdModule.id, course_id: course.id }, { where: { id: origLesson.assignment_ids }, transaction });
                            }
                            if (origLesson.quizzes && origLesson.quizzes.length > 0) {
                                await Quiz.update({ lesson_id: createdLesson.id, module_id: createdModule.id, course_id: course.id }, { where: { id: origLesson.quizzes }, transaction });
                            }

                            // Sync lesson content blocks / media attachments
                            await handleContentSync('lesson', createdLesson.id, origLesson, transaction);

                            if (origLesson.topics && createdLesson.topics) {
                                for (let tIdx = 0; tIdx < origLesson.topics.length; tIdx++) {
                                    const origTopic = origLesson.topics[tIdx];
                                    const createdTopic = createdLesson.topics[tIdx];
                                    // Sync topic content blocks / media attachments
                                    await handleContentSync('topic', createdTopic.id, origTopic, transaction);
                                }
                            }
                        }
                    }
                }
            }

            return await this.getCourseById(course.id, transaction);
        });
    }

    async getCourses(query = {}) {
        const { search, status, institution_id, page = 1, limit = 10 } = query;
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
                            FROM "lessons" l
                            WHERE l."module_id" IN (
                                SELECT id FROM "modules" WHERE "course_id" = "Course"."id"
                            )
                        )`),
                        'total_lessons'
                    ],
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM "topics" t
                            WHERE t."lesson_id" IN (
                                SELECT id FROM "lessons" WHERE "module_id" IN (
                                    SELECT id FROM "modules" WHERE "course_id" = "Course"."id"
                                )
                            )
                        )`),
                        'total_topics'
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

    async getCourseById(id, transaction = null) {
        const course = await Course.findByPk(id, {
            include: [
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
            ],
            order: [
                [{ model: Module, as: 'modules' }, 'order_num', 'ASC'],
                [{ model: Module, as: 'modules' }, { model: Lesson, as: 'lessons' }, 'order_num', 'ASC'],
                [{ model: Module, as: 'modules' }, { model: Lesson, as: 'lessons' }, { model: Topic, as: 'topics' }, 'order_num', 'ASC']
            ],
            transaction
        });
        if (!course) {
            const error = new Error('Course not found');
            error.statusCode = 404;
            throw error;
        }

        const courseJson = course.toJSON();

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
        // Handle status mapping
        if (data.status === 'published') {
            data.status = 'active';
        }

        const course = await Course.findByPk(id);
        if (!course) {
            const error = new Error('Course not found');
            error.statusCode = 404;
            throw error;
        }

        mapQuizIdsToQuizzes(data, true);

        await sequelize.transaction(async (transaction) => {
            const { modules: inputModules, assignment_ids: courseAssignmentIds, quizzes: ignoredQuizzes, quiz_ids: ignoredQuizIds, ...courseData } = data;
            
            // 1. Update Course metadata
            await course.update(courseData, { transaction });

            // 2. Link Course assignments (unlink old first)
            if (courseAssignmentIds !== undefined) {
                await Assignment.update(
                    { course_id: null },
                    { where: { course_id: course.id, module_id: null, lesson_id: null }, transaction }
                );
                if (Array.isArray(courseAssignmentIds) && courseAssignmentIds.length > 0) {
                    await Assignment.update(
                        { course_id: course.id },
                        { where: { id: courseAssignmentIds }, transaction }
                    );
                }
            }

            // 3. Sync Modules if provided
            if (inputModules !== undefined) {
                const existingModules = await Module.findAll({ where: { course_id: course.id }, transaction });
                const inputModuleIds = inputModules.map(m => m.id).filter(Boolean);
                
                // Delete modules not in input
                const modulesToDelete = existingModules.filter(m => !inputModuleIds.includes(m.id));
                for (const mToDelete of modulesToDelete) {
                    const lessons = await Lesson.findAll({ where: { module_id: mToDelete.id }, transaction });
                    for (const les of lessons) {
                        const topics = await Topic.findAll({ where: { lesson_id: les.id }, transaction });
                        for (const top of topics) {
                            await top.destroy({ transaction });
                        }
                        await Assignment.update({ lesson_id: null, module_id: null, course_id: null }, { where: { lesson_id: les.id }, transaction });
                        await Quiz.update({ lesson_id: null, module_id: null, course_id: null }, { where: { lesson_id: les.id }, transaction });
                        await les.destroy({ transaction });
                    }
                    await Assignment.update({ module_id: null, course_id: null }, { where: { module_id: mToDelete.id }, transaction });
                    await Quiz.update({ module_id: null, course_id: null }, { where: { module_id: mToDelete.id }, transaction });
                    await mToDelete.destroy({ transaction });
                }

                // Create or Update modules
                for (const mData of inputModules) {
                    let mod;
                    const { lessons: inputLessons, assignment_ids: mAssignmentIds, quizzes: mQuizzes, ...moduleFields } = mData;
                    const moduleDbData = prepareEntityDbData(moduleFields);
                    
                    if (mData.id) {
                        mod = existingModules.find(m => m.id === mData.id);
                        if (mod) {
                            await mod.update(moduleDbData, { transaction });
                        } else {
                            mod = await Module.create({ ...moduleDbData, course_id: course.id }, { transaction });
                        }
                    } else {
                        mod = await Module.create({ ...moduleDbData, course_id: course.id }, { transaction });
                    }
                    // Sync module content blocks / media attachments
                    await handleContentSync('module', mod.id, mData, transaction);

                    // Link module-level assessments
                    if (mAssignmentIds !== undefined) {
                        await Assignment.update({ module_id: null, course_id: null }, { where: { module_id: mod.id }, transaction });
                        if (Array.isArray(mAssignmentIds) && mAssignmentIds.length > 0) {
                            await Assignment.update(
                                { module_id: mod.id, course_id: course.id },
                                { where: { id: mAssignmentIds }, transaction }
                            );
                        }
                    }
                    if (mQuizzes !== undefined) {
                        await Quiz.update({ module_id: null, course_id: null }, { where: { module_id: mod.id }, transaction });
                        if (Array.isArray(mQuizzes) && mQuizzes.length > 0) {
                            await Quiz.update(
                                { module_id: mod.id, course_id: course.id },
                                { where: { id: mQuizzes }, transaction }
                            );
                        }
                    }

                    // Sync Lessons for this module
                    if (inputLessons !== undefined) {
                        const existingLessons = await Lesson.findAll({ where: { module_id: mod.id }, transaction });
                        const inputLessonIds = inputLessons.map(l => l.id).filter(Boolean);

                        // Delete lessons not in input
                        const lessonsToDelete = existingLessons.filter(l => !inputLessonIds.includes(l.id));
                        for (const lToDelete of lessonsToDelete) {
                            const topics = await Topic.findAll({ where: { lesson_id: lToDelete.id }, transaction });
                            for (const top of topics) {
                                await top.destroy({ transaction });
                            }
                            await Assignment.update({ lesson_id: null, module_id: null, course_id: null }, { where: { lesson_id: lToDelete.id }, transaction });
                            await Quiz.update({ lesson_id: null, module_id: null, course_id: null }, { where: { lesson_id: lToDelete.id }, transaction });
                            await lToDelete.destroy({ transaction });
                        }

                        // Create or Update lessons
                        for (const lData of inputLessons) {
                            let les;
                            const { topics: inputTopics, assignment_ids: lAssignmentIds, quizzes: lQuizzes, ...lessonFields } = lData;
                            const lessonDbData = prepareEntityDbData(lessonFields);

                            if (lData.id) {
                                les = existingLessons.find(l => l.id === lData.id);
                                if (les) {
                                    await les.update(lessonDbData, { transaction });
                                } else {
                                    les = await Lesson.create({ ...lessonDbData, module_id: mod.id }, { transaction });
                                }
                            } else {
                                les = await Lesson.create({ ...lessonDbData, module_id: mod.id }, { transaction });
                            }
                            // Sync lesson content blocks / media attachments
                            await handleContentSync('lesson', les.id, lData, transaction);

                            // Link lesson-level assessments
                            if (lAssignmentIds !== undefined) {
                                await Assignment.update({ lesson_id: null, module_id: null, course_id: null }, { where: { lesson_id: les.id }, transaction });
                                if (Array.isArray(lAssignmentIds) && lAssignmentIds.length > 0) {
                                    await Assignment.update(
                                        { lesson_id: les.id, module_id: mod.id, course_id: course.id },
                                        { where: { id: lAssignmentIds }, transaction }
                                    );
                                }
                            }
                            if (lQuizzes !== undefined) {
                                await Quiz.update({ lesson_id: null, module_id: null, course_id: null }, { where: { lesson_id: les.id }, transaction });
                                if (Array.isArray(lQuizzes) && lQuizzes.length > 0) {
                                    await Quiz.update(
                                        { lesson_id: les.id, module_id: mod.id, course_id: course.id },
                                        { where: { id: lQuizzes }, transaction }
                                    );
                                }
                            }

                            // Sync Topics for this lesson
                            if (inputTopics !== undefined) {
                                const existingTopics = await Topic.findAll({ where: { lesson_id: les.id }, transaction });
                                const inputTopicIds = inputTopics.map(t => t.id).filter(Boolean);

                                // Delete topics not in input
                                const topicsToDelete = existingTopics.filter(t => !inputTopicIds.includes(t.id));
                                for (const tToDelete of topicsToDelete) {
                                    await tToDelete.destroy({ transaction });
                                }

                                // Create or Update topics
                                for (const tData of inputTopics) {
                                    let top;
                                    const topicDbData = prepareEntityDbData(tData);

                                    if (tData.id) {
                                        top = existingTopics.find(t => t.id === tData.id);
                                        if (top) {
                                            await top.update(topicDbData, { transaction });
                                        } else {
                                            top = await Topic.create({ ...topicDbData, lesson_id: les.id }, { transaction });
                                        }
                                    } else {
                                        top = await Topic.create({ ...topicDbData, lesson_id: les.id }, { transaction });
                                    }
                                    // Sync topic content blocks / media attachments
                                    await handleContentSync('topic', top.id, tData, transaction);
                                }
                            }
                        }
                    }
                }
            }
        });

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
        const rawModules = Array.isArray(courseJson.modules) ? courseJson.modules : [];

        // Serialize media into grouped arrays before building the response
        const modulesJson = rawModules.map(m => {
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

        for (let i = 0; i < modulesJson.length; i++) {
            const mod = modulesJson[i];
            
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
                    const prevMod = modulesJson.find(m => m.order_num === mod.order_num - 1);
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

        this.formatMediaUrls(courseJson);

        return {
            ...courseJson,
            modules: modulesJson
        };
    }
}

module.exports = new CourseService();
