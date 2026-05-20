const reportsService = require('../../services/institutionRep/reports.service');

const getRecentReports = async (req, res) => {
    try {
        const institutionId = req.user.institution_id;
        const { search } = req.query;

        const reports = await reportsService.getRecentReports(institutionId, search);

        return res.status(200).json({
            success: true,
            data: {
                reports
            }
        });
    } catch (error) {
        console.error('Error fetching recent reports:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getRecentReports
};
