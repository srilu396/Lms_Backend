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
            avatar_url: user.avatar_url || '/uploads/profiles/institution_rep_profile_image.webp',
            role: 'institution_representative',
            designation: user.designation || user.title || 'Senior Coordinator',
            institution_id: institution.id,
            institution_name: institution.name,
            status: user.is_active ? 'active' : 'inactive',
            member_since: dayjs(user.created_at).format('MMM YYYY')
        };
    }
}

module.exports = new InstitutionRepProfileService();
