const { ContactRequest } = require('../models');

class ContactController {
    // POST /api/v1/contact-requests
    async createContactRequest(req, res, next) {
        try {
            const { full_name, email, role, message } = req.body;

            const contact = await ContactRequest.create({
                full_name,
                email,
                role,
                message
            });

            res.status(201).json({
                success: true,
                message: 'Your message has been sent successfully. We will get back to you shortly.',
                data: contact
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/v1/contact-requests
    async getContactRequests(req, res, next) {
        try {
            // Can add pagination if desired, keeping simple block to return all
            const limit = parseInt(req.query.limit) || 100;
            const contacts = await ContactRequest.findAll({
                order: [['created_at', 'DESC']],
                limit
            });

            res.status(200).json({
                success: true,
                message: 'Contact requests retrieved successfully',
                data: contacts
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/v1/contact-requests/:id
    async getContactRequestById(req, res, next) {
        try {
            const { id } = req.params;
            const contact = await ContactRequest.findByPk(id);

            if (!contact) {
                return res.status(404).json({
                    success: false,
                    message: 'Contact request not found'
                });
            }

            res.status(200).json({
                success: true,
                message: 'Contact request fetched successfully',
                data: contact
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ContactController();
