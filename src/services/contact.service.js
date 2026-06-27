const { ContactRequest, Sequelize } = require('../models');
const { Op } = Sequelize;

class ContactService {
    async createContactRequest(data) {
        const { full_name, email, role, message } = data;
        const contact = await ContactRequest.create({
            full_name,
            email,
            role,
            message
        });
        return contact;
    }

    async getContactRequests(query) {
        const { search, role, filter, page, pagination, limit = 10 } = query;
        
        const appliedRole = role || filter;
        const appliedPage = page || pagination || 1;

        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 100);
        const parsedPage = Math.max(parseInt(appliedPage, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const where = {};

        if (appliedRole) {
            where.role = appliedRole;
        }

        if (search) {
            const safeSearch = search.trim();
            where[Op.or] = [
                { full_name: { [Op.iLike]: `%${safeSearch}%` } },
                { email: { [Op.iLike]: `%${safeSearch}%` } },
                { message: { [Op.iLike]: `%${safeSearch}%` } }
            ];
        }

        const { count, rows } = await ContactRequest.findAndCountAll({
            where,
            limit: parsedLimit,
            offset: offset,
            order: [['created_at', 'DESC']]
        });

        return {
            records: rows,
            pagination: {
                page: parsedPage,
                limit: parsedLimit,
                total_records: count,
                total_pages: Math.ceil(count / parsedLimit)
            }
        };
    }

    async getContactRequestById(id) {
        const contact = await ContactRequest.findByPk(id);
        if (!contact) {
            const error = new Error('Contact request not found');
            error.statusCode = 404;
            throw error;
        }
        return contact;
    }

    async deleteContactRequest(id) {
        const contact = await ContactRequest.findByPk(id);
        if (!contact) {
            const error = new Error('Contact request not found');
            error.statusCode = 404;
            throw error;
        }
        await contact.destroy();
        return true;
    }

    async getContactStats() {
        const [total_requests, admin_requests, institution_representative_requests] = await Promise.all([
            ContactRequest.count(),
            ContactRequest.count({ where: { role: 'admin' } }),
            ContactRequest.count({ where: { role: 'institution_representative' } })
        ]);

        return {
            total_requests,
            admin_requests,
            institution_representative_requests
        };
    }
}

module.exports = new ContactService();
