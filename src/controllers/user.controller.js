const userService = require('../services/user.service');

class UserController {
    // POST /users
    async createUser(req, res, next) {
        try {
            const user = await userService.createUser(req.body);
            res.status(201).json({
                success: true,
                message: 'User created successfully',
                data: user
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /users
    async getUsers(req, res) {
        try {
            const result = await userService.getUsers(req.query);
            
            let message = 'Users retrieved successfully';
            if (req.query.search && result.data.length === 0) {
                message = 'No users found matching your search criteria.';
            }

            res.status(200).json({
                success: true,
                message: message,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving users'
            });
        }
    }

    // GET /users/:id
    async getUserById(req, res) {
        try {
            const user = await userService.getUserById(req.params.id);
            res.status(200).json({
                success: true,
                message: 'User retrieved successfully',
                data: user
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error fetching user'
            });
        }
    }

    // GET /users/stats
    async getUserStats(req, res) {
        try {
            const stats = await userService.getUserStats();
            res.status(200).json({
                success: true,
                message: 'User stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving user stats'
            });
        }
    }

    // PUT /users/:id
    async updateUser(req, res) {
        try {
            const updateData = { ...req.body };
            delete updateData.status;
            delete updateData.is_active;

            const user = await userService.updateUser(req.params.id, updateData);
            res.status(200).json({
                success: true,
                message: 'User updated successfully',
                data: user
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error updating user'
            });
        }
    }

    // PATCH /users/:id/status
    async updateUserStatus(req, res) {
        try {
            const { status } = req.body;
            const user = await userService.updateUserStatus(req.params.id, status);
            res.status(200).json({
                success: true,
                message: `User status updated to ${status} successfully`,
                data: user
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error updating user status'
            });
        }
    }

    // DELETE /users/:id
    async deleteUser(req, res) {
        try {
            await userService.deleteUser(req.params.id);
            res.status(200).json({
                success: true,
                message: 'User deleted successfully',
                data: null
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error deleting user'
            });
        }
    }
}

module.exports = new UserController();
