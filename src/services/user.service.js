const { User, Institution, TutorInstitutionAssignment, sequelize, Sequelize } = require('../models');
const { Op } = Sequelize;
const bcrypt = require('bcryptjs');

class UserService {
    async createUser(data) {
        const { full_name, email, password, role, institution_id, is_active } = data;
        let institutionIdToAssign = null;

        // Validate institution requirements
        if (role === 'institution_representative') {
            if (!institution_id) {
                const error = new Error('institution_id is required for institution_representative');
                error.statusCode = 400;
                throw error;
            }
            const institution = await Institution.findByPk(institution_id);
            if (!institution) {
                const error = new Error(`Institution with id "${institution_id}" not found`);
                error.statusCode = 404;
                throw error;
            }
            institutionIdToAssign = institution.id;
        }

        // Default username generation if needed to satisfy DB unique constraint
        const username = data.username || email.split('@')[0] + Math.floor(Math.random() * 10000);

        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        // Run user creation inside a transaction
        const t = await sequelize.transaction();

        try {
            const user = await User.create({
                full_name,
                email,
                username,
                password_hash,
                role: role,
                is_active: is_active !== undefined ? is_active : true
            }, { transaction: t });

            // If an institution ID was resolved, link user to institution
            if (institutionIdToAssign && role === 'institution_representative') {
                await TutorInstitutionAssignment.create({
                    tutor_id: user.id,
                    institution_id: institutionIdToAssign
                }, { transaction: t });
            }

            await t.commit();

            // Fetch clean object without password hash
            return await User.findByPk(user.id, {
                attributes: { exclude: ['password_hash'] }
            });
        } catch (error) {
            await t.rollback();
            throw error;
        }
    }

    async getUsers(query) {
        const { search, role, page = 1, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = parseInt(page, 10);
        const offset = (parsedPage - 1) * parsedLimit;

        const where = {};

        if (role) {
            where.role = role;
        }

        if (search) {
            const safeSearch = search.trim().slice(0, 50);
            const searchId = parseInt(safeSearch, 10);
            const searchConditions = [
                { full_name: { [Op.iLike]: `%${safeSearch}%` } },
                { email: { [Op.iLike]: `%${safeSearch}%` } }
            ];
            if (!isNaN(searchId)) {
                searchConditions.push({ id: searchId });
            }

            where[Op.or] = searchConditions;
        }

        const { count, rows } = await User.findAndCountAll({
            where,
            limit: parsedLimit,
            offset: offset,
            attributes: ['id', 'full_name', 'username', 'email', 'role', 'created_at', 'is_active', 'avatar_url'],
            order: [['created_at', 'DESC']]
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

    async getUserById(id) {
        const user = await User.findByPk(id, {
            attributes: ['id', 'full_name', 'username', 'email', 'role', 'created_at', 'is_active', 'avatar_url']
        });
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        return user;
    }

    async getUserStats() {
        const [total_admins, total_representatives, total_institutions] = await Promise.all([
            User.count({ where: { role: 'admin' } }),
            User.count({ where: { role: 'institution_representative' } }),
            Institution.count()
        ]);
        
        return {
            total_admins,
            total_representatives,
            total_institutions
        };
    }

    async updateUser(id, updateData) {
        const user = await User.findByPk(id);
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        if (updateData.password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password_hash = await bcrypt.hash(updateData.password, salt);
            delete updateData.password;
        }

        await user.update(updateData);

        return await User.findByPk(id, {
            attributes: { exclude: ['password_hash'] }
        });
    }

    async deleteUser(id) {
        const user = await User.findByPk(id);
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        if (user.is_active) {
            const error = new Error('Active users cannot be deleted. Please deactivate the user first.');
            error.statusCode = 400;
            throw error;
        }

        await user.destroy(); // Soft delete because of paranoid: true
        return true;
    }
}

module.exports = new UserService();
