const userService = require('../services/user.service');
const adminService = require('../services/admin.service');

class AdminController {
    async getDashboard(req, res, next) {
        try {
            const stats = await adminService.getDashboardStats();
            res.status(200).json({
                success: true,
                message: 'Admin dashboard stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

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
