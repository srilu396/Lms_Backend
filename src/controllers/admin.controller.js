const userService = require('../services/user.service');

class AdminController {
    async createUser(req, res, next) {
        try {
            const { email, password, role } = req.body;

            // In our system, full_name is required by User model, but admin might only provide email and password
            // We'll use the part before @ as full_name if not provided.
            const full_name = req.body.full_name || email.split('@')[0];

            const userData = {
                email,
                password,
                role: role || 'user',
                full_name,
                username: req.body.username || email.split('@')[0] + Math.floor(Math.random() * 10000),
                institution_id: req.body.institution_id
            };

            const user = await userService.createUser(userData);

            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: user
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AdminController();
