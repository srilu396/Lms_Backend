const { Institution, Sequelize } = require('../models');
const { Op } = Sequelize;

class InstitutionService {
    // Basic search function for institutions
    async searchInstitutions(query) {
        const { search, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);

        const where = {};

        if (search) {
            const safeSearch = search.trim().slice(0, 50);
            where.name = {
                [Op.iLike]: `%${safeSearch}%` // For Postgres
            };
        }

        const rows = await Institution.findAll({
            where,
            limit: parsedLimit,
            attributes: ['id', 'name'],
            order: [['name', 'ASC']]
        });

        return {
            data: rows
        };
    }
}

module.exports = new InstitutionService();
