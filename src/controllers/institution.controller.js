const institutionService = require('../services/institution.service');

class InstitutionController {
    // GET /institutions/search
    async searchInstitutions(req, res) {
        try {
            const result = await institutionService.searchInstitutions(req.query);
            res.status(200).json({
                success: true,
                message: 'Institutions searched successfully',
                data: result.data
            });
        } catch (error) {
            console.error('Error searching institutions:', error);
            res.status(500).json({
                success: false,
                message: 'Server error parsing search query'
            });
        }
    }
}

module.exports = new InstitutionController();
