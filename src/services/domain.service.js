const { Domain, Assignment, BatchAssignment, Batch, Course, Student, Enrollment, Module, Topic, Lesson, LessonProgress, sequelize } = require('../models');
const { Op } = require('sequelize');

class DomainService {
    async createDomain(data) {
        // Prevent duplicate domains
        const existingDomain = await Domain.findOne({
            where: {
                name: { [Op.iLike]: data.name.trim() },
                status: 'active'
            }
        });

        if (existingDomain) {
            const error = new Error('A domain with this name already exists');
            error.statusCode = 400;
            throw error;
        }

        if (data.assignment_ids && data.assignment_ids.length > 0) {
            const count = await Assignment.count({
                where: { id: { [Op.in]: data.assignment_ids } }
            });
            if (count !== data.assignment_ids.length) {
                const error = new Error(`One or more assignment IDs were not found`);
                error.statusCode = 404;
                throw error;
            }
        }

        const domain = await Domain.create(data);

        // Link courses to domain if provided
        if (data.course_ids && data.course_ids.length > 0) {
            await Course.update(
                { domain_id: domain.id },
                { where: { id: { [Op.in]: data.course_ids } } }
            );
        }

        // Link assignments to domain if provided
        if (data.assignment_ids && data.assignment_ids.length > 0) {
            await Assignment.update(
                { domain_id: domain.id },
                { where: { id: { [Op.in]: data.assignment_ids } } }
            );
        }

        return await this.getDomainById(domain.id);
    }

    async getDomains(query = {}, user = null) {
        const { search, status, page = 1, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const where = {};
        if (status) {
            where.status = status;
        }
        if (search) {
            where.name = { [Op.iLike]: `%${search.trim()}%` };
        }

        const { count, rows } = await Domain.findAndCountAll({
            where,
            include: [
                {
                    model: Course,
                    as: 'courses',
                    attributes: {
                        include: [
                            [
                                sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM "modules"
                                    WHERE "modules"."course_id" = "courses"."id"
                                )`),
                                'no_of_modules'
                            ]
                        ]
                    }
                }
            ],
            limit: parsedLimit,
            offset: offset,
            order: [['updated_at', 'DESC']],
            distinct: true
        });

        const data = await Promise.all(rows.map(async (domain) => {
            const d = domain.toJSON();
            let assignments = [];
            
            const populatedCourses = await this._populateProgressForCourses(user, d.courses || []);
            d.courses = populatedCourses;
            
            let totalDomainProgress = 0;
            let allCoursesCompleted = populatedCourses.length > 0;
            
            if (populatedCourses.length > 0) {
                totalDomainProgress = Math.round(populatedCourses.reduce((sum, c) => sum + (c.progress || 0), 0) / populatedCourses.length);
                allCoursesCompleted = populatedCourses.every(c => c.progress === 100);
            } else {
                allCoursesCompleted = false;
            }

            if (d.assignment_ids && d.assignment_ids.length > 0) {
                assignments = await Assignment.findAll({
                    where: { id: { [Op.in]: d.assignment_ids } },
                    attributes: ['id', 'title']
                });
                assignments = assignments.map(a => ({
                    ...a.toJSON(),
                    is_locked: !allCoursesCompleted
                }));
            }

            return {
                domain_id: d.id,
                domain_image_url: d.image_url,
                domain_name: d.name,
                progress: totalDomainProgress,
                tags: d.tags,
                total_courses_count: d.courses ? d.courses.length : 0,
                courses: d.courses || [],
                last_updated_date: d.updated_at,
                assignment_ids: d.assignment_ids,
                assignments: assignments,
                status: d.status,
                description: d.description,
                view: d.id
            };
        }));

        return {
            data,
            pagination: {
                total: count,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(count / parsedLimit)
            }
        };
    }

    async getDomainById(id, query = {}, user = null) {
        const domain = await Domain.findByPk(id);

        if (!domain) {
            const error = new Error('Domain not found');
            error.statusCode = 404;
            throw error;
        }

        const d = domain.toJSON();
        
        const { search, page = 1, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const courseWhere = { domain_id: id };
        if (search) {
            courseWhere.name = { [Op.iLike]: `%${search.trim()}%` };
        }

        const { count: courseCount, rows: courseRows } = await Course.findAndCountAll({
            where: courseWhere,
            attributes: {
                include: [
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM "modules"
                            WHERE "modules"."course_id" = "Course"."id"
                        )`),
                        'no_of_modules'
                    ]
                ]
            },
            limit: parsedLimit,
            offset: offset,
            order: [['created_at', 'ASC']],
            distinct: true
        });

        // We also need ALL courses to calculate total domain progress correctly,
        // or just calculate domain progress based on the paginated courses?
        // Usually progress is overall, so let's fetch all courses for progress calc.
        const allCourses = await Course.findAll({ where: { domain_id: id }, order: [['created_at', 'ASC']] });
        const allPopulatedCourses = await this._populateProgressForCourses(user, allCourses);
        
        let totalDomainProgress = 0;
        let allCoursesCompleted = allPopulatedCourses.length > 0;
        
        if (allPopulatedCourses.length > 0) {
            totalDomainProgress = Math.round(allPopulatedCourses.reduce((sum, c) => sum + (c.progress || 0), 0) / allPopulatedCourses.length);
            allCoursesCompleted = allPopulatedCourses.every(c => c.progress === 100);
        } else {
            allCoursesCompleted = false;
        }

        // Now map the paginated courses to include their progress
        const paginatedCourseIds = courseRows.map(c => c.id);
        const populatedCourses = allPopulatedCourses.filter(c => paginatedCourseIds.includes(c.id));

        let assignments = [];
        if (d.assignment_ids && d.assignment_ids.length > 0) {
            assignments = await Assignment.findAll({
                where: { id: { [Op.in]: d.assignment_ids } }
            });
            assignments = assignments.map(a => ({
                ...a.toJSON(),
                is_locked: !allCoursesCompleted
            }));
        }

        return {
            domain_id: d.id,
            domain_image_url: d.image_url,
            domain_name: d.name,
            progress: totalDomainProgress,
            tags: d.tags,
            total_courses_count: courseCount,
            courses: {
                data: populatedCourses,
                pagination: {
                    total: courseCount,
                    page: parsedPage,
                    limit: parsedLimit,
                    totalPages: Math.ceil(courseCount / parsedLimit)
                }
            },
            last_updated_date: d.updated_at,
            assignment_ids: d.assignment_ids,
            assignments: assignments,
            status: d.status,
            description: d.description,
            view: d.id
        };
    }

    async updateDomain(id, data) {
        const domain = await Domain.findByPk(id);
        if (!domain) {
            const error = new Error('Domain not found');
            error.statusCode = 404;
            throw error;
        }

        // Validate assignments if provided
        if (data.assignment_ids && data.assignment_ids.length > 0) {
            const count = await Assignment.count({
                where: { id: { [Op.in]: data.assignment_ids } }
            });
            if (count !== data.assignment_ids.length) {
                const error = new Error(`One or more assignment IDs were not found`);
                error.statusCode = 404;
                throw error;
            }
        }

        // Reset domain_id for old courses if course_ids changed
        if (data.course_ids) {
            await Course.update(
                { domain_id: null },
                { where: { domain_id: id } }
            );
            if (data.course_ids.length > 0) {
                await Course.update(
                    { domain_id: id },
                    { where: { id: { [Op.in]: data.course_ids } } }
                );
            }
        }

        // Sync assignments domain_id
        if (data.assignment_ids) {
            await Assignment.update(
                { domain_id: null },
                { where: { domain_id: id } }
            );
            if (data.assignment_ids.length > 0) {
                await Assignment.update(
                    { domain_id: id },
                    { where: { id: { [Op.in]: data.assignment_ids } } }
                );
            }
        }

        await domain.update(data);
        return await this.getDomainById(id);
    }

    async deleteDomain(id) {
        const domain = await Domain.findByPk(id);
        if (!domain) {
            const error = new Error('Domain not found');
            error.statusCode = 404;
            throw error;
        }
        await domain.destroy();
        return true;
    }

    async getDomainBatches(domainId, query = {}) {
        const domain = await Domain.findByPk(domainId);
        if (!domain) {
            const error = new Error('Domain not found');
            error.statusCode = 404;
            throw error;
        }

        const { search, page = 1, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const where = {};
        if (search) {
            where.name = { [Op.iLike]: `%${search.trim()}%` };
        }

        // Return courses in this domain with their module counts
        const { count, rows } = await Course.findAndCountAll({
            where: {
                ...where,
                domain_id: domainId
            },
            attributes: {
                include: [
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM "modules"
                            WHERE "modules"."course_id" = "Course"."id"
                        )`),
                        'no_of_modules'
                    ]
                ]
            },
            include: [
                { model: Assignment, as: 'assignments' },
                { model: Batch, as: 'batches' }
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

    async getDomainStats() {
        const total = await Domain.count();
        const active = await Domain.count({ where: { status: 'active' } });

        return {
            total_domains: total,
            active_domains: active
        };
    }

    async _populateProgressForCourses(user, courses) {
        // Sort courses by ID to maintain a consistent sequence for unlocking
        const sortedCourses = [...courses].sort((a, b) => (a.id || a.course_id) - (b.id || b.course_id));
        
        let student = null;
        let enrollmentIds = [];

        if (user) {
            student = await Student.findOne({ where: { email: user.email } });
            if (student) {
                const enrollments = await Enrollment.findAll({ where: { student_id: student.id, status: 'active' } });
                enrollmentIds = enrollments.map(e => e.id);
            }
        }

        let prevCourseCompleted = true;
        const populatedCourses = [];

        for (const course of sortedCourses) {
            let cJson = course.toJSON ? course.toJSON() : course;
            let completionProgress = 0;

            if (student && enrollmentIds.length > 0) {
                const courseId = cJson.id || cJson.course_id;
                const modules = await Module.findAll({
                    where: { course_id: courseId },
                    include: [{
                        model: Topic,
                        as: 'topics',
                        include: [{ model: Lesson, as: 'lessons', attributes: ['id'] }]
                    }]
                });

                const lessonIds = [];
                modules.forEach(m => {
                    m.topics.forEach(t => {
                        t.lessons.forEach(l => lessonIds.push(l.id));
                    });
                });

                if (lessonIds.length > 0) {
                    const completedCount = await LessonProgress.count({
                        where: {
                            enrollment_id: { [Op.in]: enrollmentIds },
                            lesson_id: { [Op.in]: lessonIds },
                            is_completed: true
                        }
                    });
                    completionProgress = Math.round((completedCount / lessonIds.length) * 100);
                }
            }

            cJson.progress = completionProgress;
            cJson.is_locked = !prevCourseCompleted;
            
            if (cJson.is_locked) {
                cJson.status = 'locked';
            } else if (completionProgress === 100) {
                cJson.status = 'completed';
            } else {
                cJson.status = 'in_progress';
            }

            prevCourseCompleted = (completionProgress === 100);
            populatedCourses.push(cJson);
        }

        return populatedCourses;
    }
}

module.exports = new DomainService();
