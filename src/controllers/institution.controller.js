const { z } = require('zod');
const institutionService = require('../services/institution.service');

// Validations
const contactSchema = z.object({
    name: z.string().min(1, 'Contact name is required'),
    email: z.string().email('Invalid contact email').optional().nullable(),
    phone: z.string().optional().nullable(),
    role: z.string().optional().nullable(),
    is_primary: z.boolean().optional().default(false)
});

const createInstitutionSchema = z.object({
    name: z.string().min(1, 'Institution name is required'),
    description: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().email('Invalid email address').optional().nullable(),
    logo_url: z.string().url('Invalid logo URL').optional().nullable(),
    contacts: z.array(contactSchema).max(3, 'Maximum of 3 contacts allowed').optional()
});

const updateInstitutionSchema = createInstitutionSchema.partial();

const updateInstitutionStatusSchema = z.object({
    status: z.enum(['active', 'inactive'], {
        errorMap: () => ({ message: 'Status must be either active or inactive' })
    })
});

class InstitutionController {
    // GET /institutions/search
    async searchInstitutions(req, res) {
        try {
            const result = await institutionService.searchInstitutions(req.query);
            
            let message = 'Institutions searched successfully';
            if (req.query.search && result.data.length === 0) {
                message = 'No institutions found matching your search criteria.';
            }

            res.status(200).json({
                success: true,
                message: message,
                data: result.data
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error parsing search query'
            });
        }
    }

    // GET /institutions/lookup
    async getInstitutionLookup(req, res) {
        try {
            const result = await institutionService.getInstitutionLookup(req.query);
            
            res.status(200).json({
                success: true,
                message: 'Institutions retrieved successfully',
                data: result.data
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving institutions lookup'
            });
        }
    }
    async createInstitution(req, res) {
        try {
            // Validate request body
            const validatedData = createInstitutionSchema.parse(req.body);

            // Call service
            const newInstitution = await institutionService.createInstitution(validatedData);

            res.status(201).json({
                success: true,
                message: 'Institution created successfully',
                data: newInstitution
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: error.errors
                });
            }
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    async getInstitutions(req, res) {
        try {
            const { page, limit, search, status } = req.query;
            
            const institutions = await institutionService.getInstitutions({
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 10,
                search,
                status
            });

            let message = 'Institutions retrieved successfully';
            if (search && institutions.data.length === 0) {
                message = 'No institutions found matching your search criteria.';
            }

            res.status(200).json({
                success: true,
                message: message,
                data: institutions.data,
                meta: institutions.meta
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    async getInstitutionStats(req, res) {
        try {
            const stats = await institutionService.getInstitutionStats();
            res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    async getInstitutionById(req, res) {
        try {
            const { id } = req.params;
            const institution = await institutionService.getInstitutionById(id);

            if (!institution) {
                return res.status(404).json({
                    success: false,
                    message: 'Institution not found'
                });
            }

            res.status(200).json({
                success: true,
                data: institution
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    async updateInstitution(req, res) {
        try {
            const { id } = req.params;
            
            // Validate request body
            const validatedData = updateInstitutionSchema.parse(req.body);

            const updatedInstitution = await institutionService.updateInstitution(id, validatedData);

            res.status(200).json({
                success: true,
                message: 'Institution updated successfully',
                data: updatedInstitution
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: error.errors
                });
            }
            if (error.message === 'Institution not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    async updateInstitutionStatus(req, res) {
        try {
            const { id } = req.params;
            const validatedData = updateInstitutionStatusSchema.parse(req.body);

            const updatedInstitution = await institutionService.updateInstitutionStatus(id, validatedData.status);

            res.status(200).json({
                success: true,
                message: `Institution status updated to ${validatedData.status} successfully`,
                data: updatedInstitution
            });
        } catch (error) {
            if (error instanceof z.ZodError) {
                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: error.errors
                });
            }
            if (error.message === 'Institution not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    async deleteInstitution(req, res) {
        try {
            const { id } = req.params;
            const result = await institutionService.deleteInstitution(id);

            res.status(200).json({
                success: true,
                message: result.message
            });
        } catch (error) {
            if (error.message === 'Institution not found') {
                return res.status(404).json({
                    success: false,
                    message: error.message
                });
            }
            if (error.message.includes('cannot be deleted') || error.message.includes('associated with active batches')) {
                return res.status(400).json({
                    success: false,
                    message: error.message
                });
            }
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }
}

module.exports = new InstitutionController();
