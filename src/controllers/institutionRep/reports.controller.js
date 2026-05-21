const reportsService = require('../../services/institutionRep/reports.service');

const getRecentReports = async (req, res, next) => {
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
        next(error);
    }
};

const downloadReport = async (req, res, next) => {
    try {
        const institutionId = req.user.institution_id;
        const { reportType } = req.params;

        const validTypes = ['attendance', 'performance', 'progress', 'at_risk'];
        if (!validTypes.includes(reportType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid reportType. Must be attendance, performance, progress, or at_risk.'
            });
        }

        const { filename, doc } = await reportsService.generateReportPdf(institutionId, reportType);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

        doc.pipe(res);
        doc.end();
    } catch (error) {
        if (!res.headersSent) {
            next(error);
        }
    }
};

module.exports = {
    getRecentReports,
    downloadReport
};
