const exportReportService = require('../../services/institutionRep/export-report.service');

class ExportReportController {
    /**
     * @desc    Export full report for a specific batch
     * @route   GET /api/v1/institution-rep/batches/:batchId/export-report
     * @access  Private (Institution Representative)
     */
    async exportReport(req, res, next) {
        try {
            const batchId = req.params.batchId;
            const institutionId = req.user.institution_id;

            if (!batchId) {
                return res.status(400).json({
                    success: false,
                    message: 'Batch ID is required'
                });
            }

            // The service will directly pipe the PDF to the response
            await exportReportService.generateBatchReportPdf(batchId, institutionId, res);

        } catch (error) {
            if (error.statusCode === 404 || error.statusCode === 403) {
                return res.status(error.statusCode).json({
                    success: false,
                    message: error.message
                });
            }
            next(error);
        }
    }
}

module.exports = new ExportReportController();
