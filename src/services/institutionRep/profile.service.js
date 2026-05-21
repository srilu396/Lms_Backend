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
        if (data.username !== undefined) {
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
