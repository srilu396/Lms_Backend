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
        return await Domain.create(data);
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
            attributes: {
                include: [
                    [
                        sequelize.literal(`(
                            SELECT COUNT(DISTINCT ba.batch_id)
                            FROM batch_assignments AS ba
                            WHERE ba.assignment_id = ANY("Domain"."assignment_ids")
                        )`),
                        'total_courses_count'
                    ]
                ]
            },
            limit: parsedLimit,
            offset: offset,
            order: [['updated_at', 'DESC']],
            distinct: true
        });

        // Fetch assignments for each domain manually to provide proper context
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
                total_courses_count: parseInt(d.total_courses_count, 10) || 0,
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
            attributes: {
                include: [
                    [
                        sequelize.literal(`(
                            SELECT COUNT(DISTINCT ba.batch_id)
                            FROM batch_assignments AS ba
                            WHERE ba.assignment_id = ANY("Domain"."assignment_ids")
                        )`),
                        'total_courses_count'
                    ]
                ]
            }
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
            total_courses_count: parseInt(d.total_courses_count, 10) || 0,
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
        return await domain.update(data);
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

        const assignmentIds = domain.assignment_ids || [];

        const { count, rows } = await Batch.findAndCountAll({
            include: [
                {
                    model: BatchAssignment,
                    where: { assignment_id: { [Op.in]: assignmentIds } },
                    required: true,
                    attributes: ['due_date', 'status'],
                    include: [{ model: Assignment, attributes: ['title'] }]
                },
                {
                    model: Course,
                    attributes: ['id', 'name']
                }
            ],
            where,
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
