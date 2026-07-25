const { User, Institution, TutorInstitutionAssignment, sequelize, Sequelize } = require('../models');
const { Op } = Sequelize;
const bcrypt = require('bcryptjs');

class UserService {
    async createUser(data) {
        const { full_name, email, password, confirm_password, role, institution_id, is_active } = data;

        if (password || confirm_password) {
            if (password !== confirm_password) {
                const error = new Error('Password and confirm password do not match');
                error.statusCode = 400;
                throw error;
            }
        }

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
                is_active: true,
                institution_id: institutionIdToAssign
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
            const createdUser = await User.findByPk(user.id, {
                attributes: { exclude: ['password_hash'] },
                include: [{ model: Institution, attributes: ['id', 'name'] }]
            });
            const userJson = createdUser.toJSON();
            if (userJson.Institution) {
                userJson.institution = userJson.Institution;
                delete userJson.Institution;
            }
            return userJson;
        } catch (error) {
            await t.rollback();
            throw error;
        }
    }

    async getUsers(query) {
        const { search, role, page = 1, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const where = {};
        const allowedRoles = ['admin', 'institution_representative'];

        if (role) {
            const requestedRoles = Array.isArray(role) ? role : [role];
            const validRoles = requestedRoles.filter(r => allowedRoles.includes(r));
            
            // If they requested only unauthorized roles, return empty result without hitting DB
            if (validRoles.length === 0) {
                return {
                    data: [],
                    pagination: { total: 0, page: parsedPage, limit: parsedLimit, totalPages: 0 }
                };
            }
            where.role = { [Op.in]: validRoles };
        } else {
            where.role = { [Op.in]: allowedRoles };
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
            include: [{ model: Institution, attributes: ['id', 'name'] }],
            order: [['created_at', 'DESC']]
        });

        const formattedRows = rows.map(row => {
            const userJson = row.toJSON();
            if (userJson.Institution) {
                userJson.institution = userJson.Institution;
                delete userJson.Institution;
            }
            return userJson;
        });

        return {
            data: formattedRows,
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
            attributes: ['id', 'full_name', 'username', 'email', 'role', 'created_at', 'is_active', 'avatar_url'],
            include: [{ model: Institution, attributes: ['id', 'name'] }]
        });
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        
        const userJson = user.toJSON();
        if (userJson.Institution) {
            userJson.institution = userJson.Institution;
            delete userJson.Institution;
        }
        return userJson;
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

        delete updateData.is_active;
        delete updateData.status;

        const effectiveRole = updateData.role || user.role;

        if (effectiveRole === 'admin') {
            // Admin users must not have an associated institution
            updateData.institution_id = null;
        } else if (effectiveRole === 'institution_representative') {
            const instIdToValidate = updateData.institution_id !== undefined ? updateData.institution_id : user.institution_id;
            if (!instIdToValidate) {
                const error = new Error('institution_id is required for institution_representative');
                error.statusCode = 400;
                throw error;
            }
            if (updateData.institution_id !== undefined && updateData.institution_id !== null) {
                const institution = await Institution.findByPk(instIdToValidate);
                if (!institution) {
                    const error = new Error(`Institution with id "${instIdToValidate}" not found`);
                    error.statusCode = 404;
                    throw error;
                }
            }
        }

        if (updateData.password || updateData.confirm_password) {
            if (updateData.password !== updateData.confirm_password) {
                const error = new Error('Password and confirm password do not match');
                error.statusCode = 400;
                throw error;
            }
        }

        if (updateData.password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password_hash = await bcrypt.hash(updateData.password, salt);
            delete updateData.password;
            delete updateData.confirm_password;
        }

        await user.update(updateData);

        return await this.getUserById(id);
    }

    async updateUserStatus(id, status) {
        const user = await User.findByPk(id);
        if (!user) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }

        const targetActiveState = (status === 'active');
        if (user.is_active !== targetActiveState) {
            await user.update({ is_active: targetActiveState });
        }

        return await this.getUserById(id);
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

        // Morph unique fields to free them up for new registrations
        const timestamp = Date.now();
        const updates = {};
        
        if (user.email) {
            const [username, domain] = user.email.split('@');
            updates.email = `${username}+deleted${timestamp}@${domain || 'deleted.com'}`;
        }
        if (user.username) updates.username = `${user.username}_deleted_${timestamp}`;
        if (user.tutor_code) updates.tutor_code = `${user.tutor_code}_deleted_${timestamp}`;
        if (user.student_code) updates.student_code = `${user.student_code}_deleted_${timestamp}`;

        if (Object.keys(updates).length > 0) {
            await user.update(updates);
        }

        await user.destroy(); // Soft delete because of paranoid: true
        return true;
    }
}

module.exports = new UserService();
