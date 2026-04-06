const { Tutor, sequelize, Sequelize } = require('../models');
const { Op } = Sequelize;

class TutorService {
    async createTutor(data) {
        let passwordProvided = true;
        if (!data.password) {
            passwordProvided = false;
            // Generate impossible-to-guess placeholder since DB strictly requires a password string
            const crypto = require('crypto');
            data.password = crypto.randomBytes(32).toString('hex');
        }

        const tutor = await Tutor.create({
            full_name: data.full_name || data.fullName || data['Full name'],
            email: data.email || data['Email address'],
            mobile_number: data.mobile_number || data.mobileNumber || data.phone || data['tutor mobile number'],
            password: data.password,
            domains: Array.isArray(data.domains) ? data.domains : [],
            tags: Array.isArray(data.tags) ? data.tags : [],
            status: data.status || 'active'
        });

        const { User, PasswordResetToken } = require('../models');

        // Provision central authenticating user
        const [user, created] = await User.findOrCreate({
            where: { email: tutor.email },
            defaults: {
                full_name: tutor.full_name,
                email: tutor.email,
                username: tutor.email.split('@')[0] + Math.floor(Math.random() * 10000),
                password_hash: tutor.password,
                role: 'tutor'
            }
        });

        if (!passwordProvided) {
            const crypto = require('crypto');
            const token = crypto.randomBytes(32).toString('hex');
            const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hr validity
            
            await PasswordResetToken.create({
                user_id: user.id,
                token: token,
                expires_at: expires_at,
                is_used: false
            });
            
            const resetLink = `https://your-frontend-domain.com/setup-password?token=${token}`;
            // Log for local dev / simulated email dispatch. NEVER return in API.
            console.log(`[SECURE EMAIL DISPATCH MOCK] -> Tutor setup link for ${tutor.email}: ${resetLink}`);
        }

        return this.formatTutorOutput(tutor);
    }

    async getTutors(query) {
        const { search, status, domains, page = 1, limit = 10, rowsPerPage } = query;
        const actualLimit = rowsPerPage || limit;
        const parsedLimit = Math.min(parseInt(actualLimit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const where = {};

        if (status) {
            where.status = status;
        }

        if (domains) {
            // domains could come as a comma-separated string
            const domainArray = domains.split(',').map(d => d.trim());
            // Filter tutors that have any of the specified domains using LIKE operator
            // This works by checking if the JSON contains the domain string
            where[Op.and] = domainArray.map(domain =>
                sequelize.where(
                    sequelize.col('domains'),
                    Op.like,
                    `%${domain}%`
                )
            );
        }

        if (search) {
            const safeSearch = search.trim().slice(0, 50);
            where[Op.or] = [
                { full_name: { [Op.iLike]: `%${safeSearch}%` } },
                { email: { [Op.iLike]: `%${safeSearch}%` } }
            ];
        }

        const { count, rows } = await Tutor.findAndCountAll({
            where,
            limit: parsedLimit,
            offset: offset,
            order: [['created_at', 'DESC']]
        });

        const formattedRows = rows.map(tutor => this.formatTutorOutput(tutor));

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

    async getTutorById(id) {
        const tutor = await Tutor.findByPk(id);
        if (!tutor) {
            const error = new Error('Tutor not found');
            error.statusCode = 404;
            throw error;
        }
        return this.formatTutorOutput(tutor);
    }

    async updateTutor(id, updateData) {
        const tutor = await Tutor.findByPk(id);
        if (!tutor) {
            const error = new Error('Tutor not found');
            error.statusCode = 404;
            throw error;
        }

        const mappedData = {};
        if (updateData.full_name || updateData.fullName || updateData['Full name']) mappedData.full_name = updateData.full_name || updateData.fullName || updateData['Full name'];
        if (updateData.email || updateData['Email address']) mappedData.email = updateData.email || updateData['Email address'];
        if (updateData.mobile_number || updateData.mobileNumber || updateData.phone || updateData['tutor mobile number']) mappedData.mobile_number = updateData.mobile_number || updateData.mobileNumber || updateData.phone || updateData['tutor mobile number'];
        if (updateData.password) mappedData.password = updateData.password;
        if (updateData.status) mappedData.status = updateData.status;

        if (updateData.domains) {
            mappedData.domains = Array.isArray(updateData.domains) ? updateData.domains : [updateData.domains];
        }
        if (updateData.tags) {
            mappedData.tags = Array.isArray(updateData.tags) ? updateData.tags : [updateData.tags];
        }

        await tutor.update(mappedData);
        return this.formatTutorOutput(tutor);
    }

    async deleteTutor(id) {
        const tutor = await Tutor.findByPk(id);
        if (!tutor) {
            const error = new Error('Tutor not found');
            error.statusCode = 404;
            throw error;
        }

        if (tutor.status === 'active') {
            const error = new Error('Active tutors cannot be deleted. Please set the status to inactive first.');
            error.statusCode = 400;
            throw error;
        }

        await tutor.destroy();
        return true;
    }

    async getTotalCount() {
        const count = await Tutor.count();
        return { total_tutors: count };
    }

    async getActiveCount() {
        const count = await Tutor.count({
            where: { status: 'active' }
        });
        return { active_tutors: count };
    }

    async getNewlyAddedThisMonth() {
        // get first day of current month
        const date = new Date();
        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);

        const count = await Tutor.count({
            where: {
                created_at: {
                    [Op.gte]: firstDayOfMonth
                }
            }
        });
        return { newly_added_this_month: count };
    }

    formatTutorOutput(tutor) {
        return {
            tutor_id: tutor.id,
            tutor_name: tutor.full_name,
            email: tutor.email,
            phone: tutor.mobile_number,
            domains: tutor.domains,
            tags: tutor.tags,
            status: tutor.status,
            profile_image: tutor.profile_image
        };
    }
}

module.exports = new TutorService();
