const contactService = require('../services/contact.service');

class ContactController {
    // POST /api/v1/contact-requests
    async createContactRequest(req, res, next) {
        try {
            const contact = await contactService.createContactRequest(req.body);

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
            const result = await contactService.getContactRequests(req.query);

            res.status(200).json({
                success: true,
                message: 'Contact requests retrieved successfully',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/v1/contact-requests/stats
    async getContactStats(req, res, next) {
        try {
            const stats = await contactService.getContactStats();

            res.status(200).json({
                success: true,
                message: 'Contact request statistics retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /api/v1/contact-requests/:id
    async getContactRequestById(req, res, next) {
        try {
            const contact = await contactService.getContactRequestById(req.params.id);

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
