const { Institution, InstitutionContact, Batch, Enrollment, Course, StudentRiskReport, sequelize } = require('../models');
const { Op } = require('sequelize');

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

    /**
     * Get active institutions for dropdown lookup
     */
    async getInstitutionLookup(query) {
        const { search, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);

        const where = {
            is_active: true
        };

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
    /**
     * Create a new institution and its contacts
     */
    async createInstitution(data) {
        const { contacts, status, ...institutionData } = data;

        if (status !== undefined) {
            institutionData.is_active = (status === 'active' || status === true || status === 'true');
        }

        if (institutionData.email) {
            const existingInstitution = await Institution.findOne({
                where: { email: institutionData.email }
            });
            if (existingInstitution) {
                const error = new Error('Institution already exists with this email address.');
                error.statusCode = 409;
                throw error;
            }
        }

        const transaction = await sequelize.transaction();

        try {
            // Create the institution
            const institution = await Institution.create(institutionData, { transaction });

            // Create contacts if provided
            if (contacts && contacts.length > 0) {
                // Include the 'role' field passed from frontend
                const contactsData = contacts.map(contact => ({
                    institution_id: institution.id,
                    name: contact.name,
                    email: contact.email,
                    phone: contact.phone,
                    role: contact.role,
                    is_primary: contact.is_primary || false
                }));

                await InstitutionContact.bulkCreate(contactsData, { transaction });
            }

            await transaction.commit();

            // Return the full created object
            return await this.getInstitutionById(institution.id);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Get institutions with pagination, filtering, and aggregate stats
     */
    async getInstitutions(query) {
        const { 
            page = 1, 
            limit = 10, 
            search = '', 
            status = 'all' // 'all', 'active', 'inactive'
        } = query;

        const offset = (page - 1) * limit;

        const whereClause = {};

        // Filtering by status
        if (status === 'active') {
            whereClause.is_active = true;
        } else if (status === 'inactive') {
            whereClause.is_active = false;
        }

        // Searching by name, email or ID
        if (search) {
            // Support searching for ID in the format "INST-YYYY-ID"
            const instIdMatch = search.match(/^INST-\d{4}-(\d+)$/i);
            const searchId = instIdMatch ? Number(instIdMatch[1]) : (isNaN(Number(search)) ? null : Number(search));

            whereClause[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { email: { [Op.iLike]: `%${search}%` } },
                // Allow search by pure number or parsed prefix number
                ...(searchId !== null ? [{ id: searchId }] : [])
            ];
        }

        // Fetch institutions
        const { rows: institutions, count } = await Institution.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: InstitutionContact,
                    as: 'InstitutionContacts', // Alias based on default Sequelize naming
                    required: false
                }
            ],
            limit,
            offset,
            order: [['created_at', 'DESC']]
        });

        return {
            data: institutions,
            meta: {
                total: count,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(count / limit)
            }
        };
    }

    /**
     * Get summary statistics for institutions
     */
    async getInstitutionStats() {
        const totalInstitutions = await Institution.count();
        const activeInstitutionsCount = await Institution.count({ where: { is_active: true } });
        const pendingRegistrationsCount = await Institution.count({ where: { is_active: false } }); // Assuming inactive is pending
        
        const totalCourses = await Course.count();
        const avgCoursesPerInstitution = totalInstitutions > 0 
            ? parseFloat((totalCourses / totalInstitutions).toFixed(1)) 
            : 0;
            
        return {
            totalInstitutions,
            activeInstitutions: activeInstitutionsCount,
            avgCoursesPerInstitution,
            pendingRegistrations: pendingRegistrationsCount
        };
    }

    /**
     * Get a single institution by ID
     */
    async getInstitutionById(id) {
        return await Institution.findByPk(id, {
            include: [
                {
                    model: InstitutionContact,
                    as: 'InstitutionContacts',
                    required: false
                }
            ]
        });
    }

    /**
     * Update an institution and its contacts
     */
    async updateInstitution(id, data) {
        const { contacts, status, ...institutionData } = data;

        if (status !== undefined) {
            institutionData.is_active = (status === 'active' || status === true || status === 'true');
        }

        const institution = await Institution.findByPk(id);
        if (!institution) {
            throw new Error('Institution not found');
        }

        const transaction = await sequelize.transaction();

        try {
            // Update the institution fields
            await institution.update(institutionData, { transaction });

            // If contacts are provided, we replace the existing ones (as per typical full-update logic)
            if (contacts !== undefined) {
                // Delete existing contacts
                await InstitutionContact.destroy({
                    where: { institution_id: id },
                    transaction
                });

                // Create new contacts
                if (contacts.length > 0) {
                    const contactsData = contacts.map(contact => ({
                        institution_id: id,
                        name: contact.name,
                        email: contact.email,
                        phone: contact.phone,
                        role: contact.role,
                        is_primary: contact.is_primary || false
                    }));

                    await InstitutionContact.bulkCreate(contactsData, { transaction });
                }
            }

            await transaction.commit();

            return await this.getInstitutionById(id);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    /**
     * Delete an institution (Soft Delete)
     */
    async deleteInstitution(id) {
        const institution = await Institution.findByPk(id);
        
        if (!institution) {
            throw new Error('Institution not found');
        }

        // Rule: Cannot delete while currently active.
        if (institution.is_active) {
            throw new Error('The institution cannot be deleted while it is currently active. Please deactivate the institution first.');
        }

        // Rule: Cannot delete if associated with active batches or active students
        const activeBatchesCount = await Batch.count({
            where: {
                institution_id: id,
                status: 'active'
            }
        });

        const activeStudentsCount = await Enrollment.count({
            where: { status: 'active' },
            include: [{
                model: Batch,
                where: { institution_id: id }
            }]
        });

        if (activeBatchesCount > 0 || activeStudentsCount > 0) {
            throw new Error('The institution is associated with active batches or students. Cannot delete.');
        }

        // Soft delete
        await institution.destroy();

        return { message: 'Institution deleted successfully' };
    }
}

module.exports = new InstitutionService();
