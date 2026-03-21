const { Domain, Assignment, BatchAssignment, Batch, Course, sequelize } = require('../models');
const { Op } = require('sequelize');

class DomainService {
    async createDomain(data) {
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

    async getDomains(query = {}) {
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
                            ],
                            [
                                sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM "topics"
                                    WHERE "module_id" IN (SELECT id FROM "modules" WHERE "course_id" = "courses"."id")
                                )`),
                                'total_topics'
                            ],
                            [
                                sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM "lessons"
                                    WHERE "topic_id" IN (
                                        SELECT id FROM "topics" WHERE "module_id" IN (SELECT id FROM "modules" WHERE "course_id" = "courses"."id")
                                    )
                                )`),
                                'total_lessons'
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
            if (d.assignment_ids && d.assignment_ids.length > 0) {
                assignments = await Assignment.findAll({
                    where: { id: { [Op.in]: d.assignment_ids } },
                    attributes: ['id', 'title']
                });
            }

            return {
                domain_id: d.id,
                domain_image_url: d.image_url,
                domain_name: d.name,
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

    async getDomainById(id) {
        const domain = await Domain.findByPk(id, {
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
                            ],
                            [
                                sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM "topics"
                                    WHERE "module_id" IN (SELECT id FROM "modules" WHERE "course_id" = "courses"."id")
                                )`),
                                'total_topics'
                            ],
                            [
                                sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM "lessons"
                                    WHERE "topic_id" IN (
                                        SELECT id FROM "topics" WHERE "module_id" IN (SELECT id FROM "modules" WHERE "course_id" = "courses"."id")
                                    )
                                )`),
                                'total_lessons'
                            ]
                        ]
                    }
                }
            ]
        });

        if (!domain) {
            const error = new Error('Domain not found');
            error.statusCode = 404;
            throw error;
        }

        const d = domain.toJSON();
        let assignments = [];
        if (d.assignment_ids && d.assignment_ids.length > 0) {
            assignments = await Assignment.findAll({
                where: { id: { [Op.in]: d.assignment_ids } }
            });
        }

        return {
            domain_id: d.id,
            domain_image_url: d.image_url,
            domain_name: d.name,
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

        // Return courses in this domain with their counts
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
                    ],
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM "topics"
                            WHERE "module_id" IN (SELECT id FROM "modules" WHERE "course_id" = "Course"."id")
                        )`),
                        'total_topics'
                    ],
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)
                            FROM "lessons"
                            WHERE "topic_id" IN (
                                SELECT id FROM "topics" WHERE "module_id" IN (SELECT id FROM "modules" WHERE "course_id" = "Course"."id")
                            )
                        )`),
                        'total_lessons'
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
}

module.exports = new DomainService();
