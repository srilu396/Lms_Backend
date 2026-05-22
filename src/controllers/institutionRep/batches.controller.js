const batchesService = require('../../services/institutionRep/batches.service');
const batchExport = require('../../utils/fileGenerators/batchListExport');

class InstitutionRepBatchesController {
    /**
     * GET /api/v1/institution-rep/batches
     */
    async getBatches(req, res, next) {
        try {
            const institutionId = req.user.institution_id;
            const data = await batchesService.getBatches(req.query, institutionId);
            
            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/v1/institution-rep/batches/download
     */
    async downloadBatches(req, res, next) {
        try {
            const institutionId = req.user.institution_id;
            const formatType = req.query.format || 'csv';

            // Get all batches without pagination for export, but with same filters
            const query = { ...req.query, limit: 1000, page: 1 };
            const data = await batchesService.getBatches(query, institutionId);

            if (formatType === 'excel') {
                return await batchExport.generateExcel(data.batches, res);
            } else if (formatType === 'pdf') {
                return await batchExport.generatePDF(data.batches, res);
            } else {
                return await batchExport.generateCSV(data.batches, res);
            }
        } catch (error) {
            if (!res.headersSent) {
                next(error);
            }
        }
    }


}

module.exports = new InstitutionRepBatchesController();
