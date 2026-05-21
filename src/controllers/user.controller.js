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

    // GET /users/count/admins
    async getTotalAdmins(req, res) {
        try {
            const count = await userService.getTotalAdmins();
            res.status(200).json({
                success: true,
                message: 'Total admins retrieved successfully',
                data: { count }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving total admins'
            });
        }
    }

    // GET /users/count/representatives
    async getTotalRepresentatives(req, res) {
        try {
            const count = await userService.getTotalRepresentatives();
            res.status(200).json({
                success: true,
                message: 'Total representatives retrieved successfully',
                data: { count }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving total representatives'
            });
        }
    }

    // GET /users/count/institutions
    async getTotalInstitutions(req, res) {
        try {
            const count = await userService.getTotalInstitutions();
            res.status(200).json({
                success: true,
                message: 'Total institutions retrieved successfully',
                data: { count }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving total institutions'
            });
        }
    }

    // PUT /users/:id
    async updateUser(req, res) {
        try {
            const user = await userService.updateUser(req.params.id, req.body);
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
