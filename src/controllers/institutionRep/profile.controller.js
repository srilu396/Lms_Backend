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
}

module.exports = new InstitutionRepProfileController();
