const { Tutor, sequelize, Sequelize } = require('../models');
const { Op } = Sequelize;

class TutorService {
    async createTutor(data) {
        if (data.password || data.confirm_password) {
            if (data.password !== data.confirm_password) {
                const error = new Error('Password and confirm password do not match');
                error.statusCode = 400;
                throw error;
            }
        }

        let passwordProvided = true;
        if (!data.password) {
            passwordProvided = false;
            // Generate impossible-to-guess placeholder since DB strictly requires a password string
            const crypto = require('crypto');
            data.password = crypto.randomBytes(32).toString('hex');
        }

        const normalizedDomains = await this.normalizeDomains(data.domains);
        const normalizedTags = this.normalizeTags(data.tags);

        const tutor = await Tutor.create({
            full_name: data.full_name || data.fullName || data['Full name'],
            email: data.email || data['Email address'],
            mobile_number: data.mobile_number || data.mobileNumber || data.phone || data['tutor mobile number'],
            password: data.password,
            domains: normalizedDomains,
            tags: normalizedTags,
            status: 'active'
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
                role: 'tutor',
                is_active: true
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
        }

        return this.formatTutorOutput(tutor);
    }

    async normalizeDomains(domainsInput) {
        if (!domainsInput) return [];
        const arr = Array.isArray(domainsInput) ? domainsInput : String(domainsInput).split(',');
        const { Domain } = require('../models');
        
        const resolvedIds = new Set();
        
        for (let item of arr) {
            if (item === null || item === undefined) continue;
            const strVal = String(item).trim();
            if (!strVal) continue;

            const numId = parseInt(strVal, 10);
            if (!isNaN(numId) && String(numId) === strVal) {
                const domainRecord = await Domain.findByPk(numId);
                if (domainRecord) {
                    resolvedIds.add(domainRecord.id);
                } else {
                    resolvedIds.add(numId);
                }
            } else {
                const domainRecord = await Domain.findOne({
                    where: sequelize.where(
                        sequelize.fn('LOWER', sequelize.col('name')),
                        Op.eq,
                        strVal.toLowerCase()
                    )
                });
                if (domainRecord) {
                    resolvedIds.add(domainRecord.id);
                } else {
                    resolvedIds.add(strVal);
                }
            }
        }
        return Array.from(resolvedIds);
    }

    normalizeTags(tagsInput) {
        if (!tagsInput) return [];
        const arr = Array.isArray(tagsInput) ? tagsInput : String(tagsInput).split(',');
        const cleanTags = [];
        for (let item of arr) {
            if (item === null || item === undefined) continue;
            const str = String(item).trim();
            if (str && !cleanTags.includes(str)) {
                cleanTags.push(str);
            }
        }
        return cleanTags;
    }

    async getTutors(query = {}) {
        const { search, status, domain_id, domain, domains, page = 1, limit = 10, rowsPerPage } = query;
        
        // Proper numeric parsing for pagination
        let parsedLimit = parseInt(rowsPerPage || limit, 10);
        if (isNaN(parsedLimit) || parsedLimit <= 0) parsedLimit = 10;
        parsedLimit = Math.min(parsedLimit, 50);

        let parsedPage = parseInt(page, 10);
        if (isNaN(parsedPage) || parsedPage <= 0) parsedPage = 1;
        
        const offset = (parsedPage - 1) * parsedLimit;

        const where = {};

        if (status) {
            where.status = status;
        }

        const activeDomainFilter = domain_id || domain || domains;
        if (activeDomainFilter) {
            const filterString = String(activeDomainFilter);
            const filterArray = filterString.split(',').map(d => d.trim()).filter(Boolean);
            if (filterArray.length > 0) {
                const { Domain } = require('../models');
                const searchTerms = new Set();

                for (const val of filterArray) {
                    const numId = parseInt(val, 10);
                    if (!isNaN(numId)) {
                        searchTerms.add(numId);
                        searchTerms.add(String(numId));
                        const dom = await Domain.findByPk(numId);
                        if (dom) {
                            searchTerms.add(dom.name);
                            searchTerms.add(dom.name.toUpperCase());
                            searchTerms.add(dom.name.toLowerCase());
                        }
                    } else {
                        searchTerms.add(val);
                        searchTerms.add(val.toUpperCase());
                        searchTerms.add(val.toLowerCase());
                        const dom = await Domain.findOne({
                            where: sequelize.where(
                                sequelize.fn('LOWER', sequelize.col('name')),
                                Op.eq,
                                val.toLowerCase()
                            )
                        });
                        if (dom) {
                            searchTerms.add(dom.id);
                            searchTerms.add(String(dom.id));
                        }
                    }
                }

                const isPostgres = sequelize.getDialect() === 'postgres';
                const jsonFieldCast = isPostgres ? 'cast("domains" as text)' : 'domains';
                const termList = Array.from(searchTerms);

                where[Op.or] = termList.map(term =>
                    sequelize.where(
                        sequelize.literal(jsonFieldCast),
                        Op.like,
                        `%${term}%`
                    )
                );
            }
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
            include: [{
                model: sequelize.models.Batch,
                as: 'batches',
                attributes: ['id', 'name'],
                through: { attributes: [] }
            }],
            limit: parsedLimit,
            offset: offset,
            order: [['created_at', 'DESC']],
            distinct: true
        });

        const formattedRows = rows.map(tutor => this.formatTutorOutput(tutor, true));

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

    async getTutorLookup(query) {
        const { search, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);

        const where = {
            status: 'active'
        };

        if (search) {
            const safeSearch = search.trim().slice(0, 50);
            where[Op.or] = [
                { full_name: { [Op.iLike]: `%${safeSearch}%` } },
                { email: { [Op.iLike]: `%${safeSearch}%` } }
            ];
        }

        const rows = await Tutor.findAll({
            where,
            limit: parsedLimit,
            attributes: ['id', ['full_name', 'name']],
            order: [['full_name', 'ASC']]
        });

        const formattedRows = rows.map(t => ({
            id: t.id,
            name: t.get('name') || t.full_name
        }));

        return {
            data: formattedRows
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

        if (updateData.password || updateData.confirm_password) {
            if (updateData.password !== updateData.confirm_password) {
                const error = new Error('Password and confirm password do not match');
                error.statusCode = 400;
                throw error;
            }
        }

        const mappedData = {};
        if (updateData.full_name || updateData.fullName || updateData['Full name']) mappedData.full_name = updateData.full_name || updateData.fullName || updateData['Full name'];
        if (updateData.email || updateData['Email address']) mappedData.email = updateData.email || updateData['Email address'];
        if (updateData.mobile_number || updateData.mobileNumber || updateData.phone || updateData['tutor mobile number']) mappedData.mobile_number = updateData.mobile_number || updateData.mobileNumber || updateData.phone || updateData['tutor mobile number'];
        if (updateData.password) mappedData.password = updateData.password;

        if (updateData.domains !== undefined) {
            mappedData.domains = await this.normalizeDomains(updateData.domains);
        }
        if (updateData.tags !== undefined) {
            mappedData.tags = this.normalizeTags(updateData.tags);
        }

        await tutor.update(mappedData);
        return this.formatTutorOutput(tutor);
    }

    async updateTutorStatus(id, status) {
        const tutor = await Tutor.findByPk(id);
        if (!tutor) {
            const error = new Error('Tutor not found');
            error.statusCode = 404;
            throw error;
        }

        if (tutor.status !== status) {
            await tutor.update({ status });
        }

        // Synchronize associated User account
        const { User } = require('../models');
        const user = await User.findOne({ where: { email: tutor.email } });
        if (user) {
            const targetActiveState = (status === 'active');
            if (user.is_active !== targetActiveState) {
                await user.update({ is_active: targetActiveState });
            }
        }

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

        // Morph unique fields to free them up for new registrations
        const timestamp = Date.now();
        if (tutor.email) {
            const [username, domain] = tutor.email.split('@');
            const newEmail = `${username}+deleted${timestamp}@${domain || 'deleted.com'}`;
            await tutor.update({ email: newEmail });
        }

        await tutor.destroy();
        return true;
    }

    async getTutorStats() {
        // get first day of current month
        const date = new Date();
        const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);

        const statusStats = await Tutor.findAll({
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['status'],
            raw: true
        });

        let totalTutors = 0;
        let activeTutors = 0;
        statusStats.forEach(item => {
            const count = parseInt(item.count, 10) || 0;
            totalTutors += count;
            if (item.status === 'active') {
                activeTutors = count;
            }
        });

        const newlyAddedTutors = await Tutor.count({
            where: {
                created_at: {
                    [Op.gte]: firstDayOfMonth
                }
            }
        });

        return {
            totalTutors,
            activeTutors,
            newlyAddedTutors
        };
    }

    formatTutorOutput(tutor, includeBatches = false) {
        const output = {
            id: tutor.id,
            tutor_id: tutor.id,
            tutor_name: tutor.full_name,
            email: tutor.email,
            phone: tutor.mobile_number,
            domains: tutor.domains || [],
            tags: tutor.tags || [],
            status: tutor.status,
            profile_image: tutor.profile_image
        };

        if (includeBatches && tutor.batches) {
            output.assignedBatches = tutor.batches.map(batch => ({
                _id: batch.id,
                batchName: batch.name
            }));
        }

        return output;
    }
}

module.exports = new TutorService();
