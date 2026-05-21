const models = require('../../models');
const { User, Institution } = models;
const dayjs = require('dayjs');

class InstitutionRepProfileService {
    async getProfile(userId) {
        // Step 1: Fetch user record by userId from the users table
        const user = await User.findByPk(userId, {
            include: [
                {
                    model: Institution,
                    attributes: ['id', 'name']
                }
            ]
        });

        if (!user) {
            throw { statusCode: 404, message: 'User record not found' };
        }

        // Verify role is institution_representative
        if (user.role !== 'institution_representative') {
            throw { statusCode: 403, message: 'Access denied: User is not an institution representative' };
        }

        const institution = user.Institution;
        if (!institution) {
            throw { statusCode: 404, message: 'Institution record not found for this user' };
        }

        // Build response
        return {
            user_id: user.id,
            full_name: user.full_name,
            email: user.email,
            username: user.username,
            phone_number: user.phone_number || null,
            avatar_url: user.avatar_url || null,
            role: 'institution_representative',
            designation: user.designation || user.title || 'Senior Coordinator',
            institution_id: institution.id,
            institution_name: institution.name,
            status: user.is_active ? 'active' : 'inactive',
            member_since: dayjs(user.created_at).format('MMM YYYY')
        };
    }

    async updateProfile(userId, data) {
        const errors = {};

        // Validation rules
        if (data.full_name !== undefined) {
            if (typeof data.full_name !== 'string' || data.full_name.trim().length < 2 || data.full_name.trim().length > 100) {
                errors.full_name = 'Must be a string between 2 and 100 characters';
            }
        }

        if (data.username !== undefined) {
            if (typeof data.username !== 'string' || data.username.trim().length === 0) {
                errors.username = 'Must be a non-empty string';
            } else {
                const existingUser = await User.findOne({
                    where: {
                        username: data.username,
                        id: { [models.Sequelize.Op.ne]: userId }
                    }
                });
                if (existingUser) {
                    throw { statusCode: 409, message: 'Username already taken' };
                }
            }
        }

        if (data.phone_number !== undefined) {
            const phoneRegex = /^\+?[0-9]{10,15}$/;
            if (data.phone_number !== null && !phoneRegex.test(data.phone_number)) {
                errors.phone_number = 'Invalid phone number format';
            }
        }

        if (data.avatar_url !== undefined) {
            try {
                new URL(data.avatar_url);
            } catch (err) {
                if (data.avatar_url !== null) {
                    errors.avatar_url = 'Must be a valid URL string';
                }
            }
        }

        if (data.designation !== undefined) {
            if (typeof data.designation !== 'string' || data.designation.trim().length === 0 || data.designation.trim().length > 100) {
                errors.designation = 'Must be a non-empty string, maximum 100 characters';
            }
        }

        if (Object.keys(errors).length > 0) {
            throw { statusCode: 400, message: 'Validation failed', errors };
        }

        const updateData = {};
        if (data.full_name !== undefined) updateData.full_name = data.full_name.trim();
        if (data.username !== undefined) updateData.username = data.username.trim();
        if (data.phone_number !== undefined) updateData.phone_number = data.phone_number;
        if (data.avatar_url !== undefined) updateData.avatar_url = data.avatar_url;
        if (data.designation !== undefined) updateData.designation = data.designation.trim();

        // Update the users table record
        const user = await User.findByPk(userId);
        if (!user) {
            throw { statusCode: 404, message: 'User not found' };
        }

        if (Object.keys(updateData).length > 0) {
            await user.update(updateData);
        }

        return await this.getProfile(userId);
    }
}

module.exports = new InstitutionRepProfileService();
