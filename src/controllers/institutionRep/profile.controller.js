const institutionRepProfileService = require('../../services/institutionRep/profile.service');

class InstitutionRepProfileController {
    async getProfile(req, res, next) {
        try {
            const profile = await institutionRepProfileService.getProfile(req.user.id);
            res.status(200).json({
                success: true,
                data: profile
            });
        } catch (error) {
            next(error);
        }
    }

    async updateProfile(req, res, next) {
        try {
            const profile = await institutionRepProfileService.updateProfile(req.user.id, req.body);
            res.status(200).json({
                success: true,
                message: 'Profile updated successfully',
                data: profile
            });
        } catch (error) {
            if (error.statusCode) {
                const response = {
                    success: false,
                    message: error.message
                };
                if (error.errors) {
                    response.errors = error.errors;
                }
                return res.status(error.statusCode).json(response);
            }
            next(error);
        }
    }
}

module.exports = new InstitutionRepProfileController();
