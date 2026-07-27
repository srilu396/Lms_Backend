const { Domain, Assignment, Batch, Course, Student, Enrollment, Module, Topic, Lesson, LessonProgress, sequelize } = require('../models');
const { Op } = require('sequelize');

class DomainService {
    async createDomain(data) {
        if (!data.name || !data.name.trim()) {
            const error = new Error('Domain name is required');
            error.statusCode = 400;
            throw error;
        }

        // Prevent duplicate domain names (case-insensitive)
        const existingDomain = await Domain.findOne({
            where: {
                name: { [Op.iLike]: data.name.trim() }
            }
        });

        if (existingDomain) {
            const error = new Error('Domain name must be unique');
            error.statusCode = 400;
            throw error;
        }

        // Auto-assign status = 'active'
        const domain = await Domain.create({
            name: data.name.trim(),
            description: data.description ? data.description.trim() : null,
            status: 'active'
        });

        return await this.getDomainById(domain.id);
    }

    async getDomains(query = {}, user = null) {
        const { search, status, page = 1, limit = 10, sortBy = 'created_at', sortOrder = 'DESC' } = query;
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

        // Allowed sort columns for security
        const allowedSortFields = ['id', 'name', 'created_at', 'updated_at', 'status'];
        const actualSortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
        const actualSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        const { count, rows } = await Domain.findAndCountAll({
            where,
            attributes: {
                include: [
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)::int
                            FROM "courses"
                            WHERE "courses"."domain_id" = "Domain"."id"
                            AND "courses"."deleted_at" IS NULL
                        )`),
                        'total_courses'
                    ]
                ]
            },
            limit: parsedLimit,
            offset: offset,
            order: [[actualSortField, actualSortOrder]],
            distinct: true
        });

        const data = rows.map((domain) => {
            const d = domain.toJSON();
            const totalCourses = parseInt(d.total_courses || 0, 10);

            return {
                id: d.id,
                name: d.name,
                description: d.description,
                total_courses: totalCourses,
                created_at: d.created_at,
                created_date: d.created_at,
                updated_at: d.updated_at,
                status: d.status,
                // Legacy response properties for backwards compatibility
                domain_id: d.id,
                domain_name: d.name,
                total_courses_count: totalCourses,
                last_updated_date: d.updated_at
            };
        });

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

    async getDomainLookup(query = {}) {
        const { search, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);

        const where = {
            status: 'active'
        };

        if (search) {
            where.name = { [Op.iLike]: `%${search.trim()}%` };
        }

        const rows = await Domain.findAll({
            where,
            limit: parsedLimit,
            attributes: ['id', 'name'],
            order: [['name', 'ASC']]
        });

        return {
            data: rows
        };
    }

    async getDomainsForFilter() {
        const rows = await Domain.findAll({
            attributes: ['id', 'name', 'status'],
            order: [['name', 'ASC']]
        });

        const sortedData = rows
            .map((domain) => {
                const d = domain.toJSON();
                const statusUpper = d.status ? String(d.status).toUpperCase() : 'ACTIVE';
                return {
                    id: d.id,
                    name: d.name,
                    status: statusUpper
                };
            })
            .sort((a, b) => {
                if (a.status === b.status) {
                    return a.name.localeCompare(b.name);
                }
                return a.status === 'ACTIVE' ? -1 : 1;
            });

        return {
            data: sortedData
        };
    }


    async getDomainById(id, query = {}, user = null) {
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) {
            const error = new Error('Invalid Domain ID');
            error.statusCode = 400;
            throw error;
        }

        const domain = await Domain.findByPk(numericId, {
            attributes: {
                include: [
                    [
                        sequelize.literal(`(
                            SELECT COUNT(*)::int
                            FROM "courses"
                            WHERE "courses"."domain_id" = "Domain"."id"
                            AND "courses"."deleted_at" IS NULL
                        )`),
                        'total_courses'
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
        const totalCourses = parseInt(d.total_courses || 0, 10);

        return {
            id: d.id,
            name: d.name,
            description: d.description,
            status: d.status,
            total_courses: totalCourses,
            created_at: d.created_at,
            created_date: d.created_at,
            updated_at: d.updated_at,
            // Legacy fields for backwards compatibility
            domain_id: d.id,
            domain_name: d.name,
            total_courses_count: totalCourses
        };
    }

    async updateDomain(id, data) {
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) {
            const error = new Error('Invalid Domain ID');
            error.statusCode = 400;
            throw error;
        }

        const domain = await Domain.findByPk(numericId);
        if (!domain) {
            const error = new Error('Domain not found');
            error.statusCode = 404;
            throw error;
        }

        const updatePayload = {};

        if (data.name !== undefined && data.name.trim() !== '') {
            const trimmedName = data.name.trim();

            // Validate uniqueness if name changed
            if (trimmedName.toLowerCase() !== domain.name.toLowerCase()) {
                const existingDomain = await Domain.findOne({
                    where: {
                        name: { [Op.iLike]: trimmedName },
                        id: { [Op.ne]: numericId }
                    }
                });

                if (existingDomain) {
                    const error = new Error('Domain name must be unique');
                    error.statusCode = 400;
                    throw error;
                }
            }

            updatePayload.name = trimmedName;
        }

        if (data.description !== undefined) {
            updatePayload.description = data.description ? data.description.trim() : null;
        }

        // Status cannot be updated via this endpoint
        await domain.update(updatePayload);

        return await this.getDomainById(numericId);
    }

    async updateDomainStatus(id, status) {
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) {
            const error = new Error('Invalid Domain ID');
            error.statusCode = 400;
            throw error;
        }

        const validStatuses = ['active', 'inactive'];
        if (!status || !validStatuses.includes(status.toLowerCase())) {
            const error = new Error('Invalid status. Status must be either active or inactive');
            error.statusCode = 400;
            throw error;
        }

        const domain = await Domain.findByPk(numericId);
        if (!domain) {
            const error = new Error('Domain not found');
            error.statusCode = 404;
            throw error;
        }

        await domain.update({ status: status.toLowerCase() });

        return await this.getDomainById(numericId);
    }

    async deleteDomain(id) {
        const numericId = parseInt(id, 10);
        if (isNaN(numericId)) {
            const error = new Error('Invalid Domain ID');
            error.statusCode = 400;
            throw error;
        }

        const domain = await Domain.findByPk(numericId);
        if (!domain) {
            const error = new Error('Domain not found');
            error.statusCode = 404;
            throw error;
        }

        // Rule 1: Active domain cannot be deleted
        if (domain.status === 'active') {
            const error = new Error('Active domains cannot be deleted. Please set status to inactive first.');
            error.statusCode = 400;
            throw error;
        }

        // Rule 2: Cannot delete domain with associated courses
        const associatedCourseCount = await Course.count({
            where: { domain_id: numericId }
        });

        if (associatedCourseCount > 0) {
            const error = new Error('Cannot delete domain with associated courses.');
            error.statusCode = 400;
            throw error;
        }

        await domain.destroy();
        return true;
    }

    async getDomainBatches(domainId, query = {}) {
        const numericId = parseInt(domainId, 10);
        const domain = await Domain.findByPk(numericId);
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

        const { count, rows } = await Course.findAndCountAll({
            where: {
                ...where,
                domain_id: numericId
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
        const stats = await Domain.findAll({
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['status'],
            raw: true
        });

        let total = 0;
        let active = 0;
        let inactive = 0;

        stats.forEach(item => {
            const count = parseInt(item.count, 10) || 0;
            total += count;
            if (item.status === 'active') {
                active = count;
            } else if (item.status === 'inactive') {
                inactive = count;
            }
        });

        return {
            total_domains: total,
            active_domains: active,
            inactive_domains: inactive
        };
    }
}

module.exports = new DomainService();
