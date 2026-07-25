const domainService = require('../services/domain.service');

class DomainController {
    async createDomain(req, res) {
        try {
            const domain = await domainService.createDomain(req.body);
            res.status(201).json({
                success: true,
                message: 'Domain created successfully',
                data: domain
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error creating domain'
            });
        }
    }

    async getDomains(req, res) {
        try {
            const result = await domainService.getDomains(req.query, req.user);
            res.status(200).json({
                success: true,
                message: 'Domains retrieved successfully',
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving domains'
            });
        }
    }

    async getDomainLookup(req, res) {
        try {
            const result = await domainService.getDomainLookup(req.query);
            res.status(200).json({
                success: true,
                message: 'Domains lookup retrieved successfully',
                data: result.data
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving domains lookup'
            });
        }
    }

    async getDomainById(req, res) {
        try {
            const domain = await domainService.getDomainById(req.params.id, req.query, req.user);
            res.status(200).json({
                success: true,
                message: 'Domain retrieved successfully',
                data: domain
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error fetching domain'
            });
        }
    }

    async updateDomain(req, res) {
        try {
            const domain = await domainService.updateDomain(req.params.id, req.body);
            res.status(200).json({
                success: true,
                message: 'Domain updated successfully',
                data: domain
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error updating domain'
            });
        }
    }

    async updateDomainStatus(req, res) {
        try {
            const domain = await domainService.updateDomainStatus(req.params.id, req.body.status);
            res.status(200).json({
                success: true,
                message: 'Domain status updated successfully',
                data: domain
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error updating domain status'
            });
        }
    }

    async deleteDomain(req, res) {
        try {
            await domainService.deleteDomain(req.params.id);
            res.status(200).json({
                success: true,
                message: 'Domain deleted successfully',
                data: null
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error deleting domain'
            });
        }
    }

    async getDomainBatches(req, res) {
        try {
            const result = await domainService.getDomainBatches(req.params.id, req.query);
            res.status(200).json({
                success: true,
                message: 'Domain batches retrieved successfully',
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error fetching domain batches'
            });
        }
    }

    async getDomainStats(req, res) {
        try {
            const stats = await domainService.getDomainStats();
            res.status(200).json({
                success: true,
                message: 'Domain statistics retrieved successfully',
                data: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving domain statistics'
            });
        }
    }
}

module.exports = new DomainController();
