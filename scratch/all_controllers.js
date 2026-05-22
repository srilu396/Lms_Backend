const attendanceCalendarService = require('../../services/institutionRep/attendance-calendar.service');

class AttendanceCalendarController {
    /**
     * GET /api/v1/institution-rep/batches/:batchId/students/:studentId/attendance-calendar
     */
    async getAttendanceCalendar(req, res, next) {
        try {
            const { batchId, studentId } = req.params;
            const { month } = req.query; // YYYY-MM
            const institutionId = req.user.institution_id;

            if (!batchId || !studentId) {
                return res.status(400).json({
                    success: false,
                    message: 'batchId and studentId are required'
                });
            }

            const data = await attendanceCalendarService.getAttendanceCalendar(
                parseInt(batchId),
                parseInt(studentId),
                institutionId,
                month
            );

            res.status(200).json({
                success: true,
                data: data
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AttendanceCalendarController();
const batchDetailsService = require('../../services/institutionRep/batch-details.service');

class BatchDetailsController {
    /**
     * GET /api/v1/institution-rep/batches/:batchId/overview
     */
    async getBatchOverview(req, res) {
        try {
            const { batchId } = req.params;
            const institutionId = req.user.institution_id;

            const data = await batchDetailsService.getBatchOverview(batchId, institutionId);

            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('getBatchOverview controller error:', error);
            
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal Server Error';

            return res.status(statusCode).json({
                success: false,
                message
            });
        }
    }
}

module.exports = new BatchDetailsController();
const batchStudentsService = require('../../services/institutionRep/batch-students.service');

class BatchStudentsController {
    /**
     * GET /api/v1/institution-rep/batches/:batchId/students
     */
    async getBatchStudents(req, res) {
        try {
            const { batchId } = req.params;
            const institutionId = req.user.institution_id;
            const { page, limit, search, status } = req.query;

            const data = await batchStudentsService.getBatchStudents(batchId, institutionId, {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 10,
                search,
                status
            });

            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('getBatchStudents controller error:', error);
            
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal Server Error';

            return res.status(statusCode).json({
                success: false,
                message
            });
        }
    }

    /**
     * GET /api/v1/institution-rep/batches/:batchId/students/:studentId/stats
     */
    async getStudentStats(req, res) {
        try {
            const { batchId, studentId } = req.params;
            const institutionId = req.user.institution_id;

            const data = await batchStudentsService.getStudentStats(batchId, studentId, institutionId);

            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('getStudentStats controller error:', error);
            
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal Server Error';

            return res.status(statusCode).json({
                success: false,
                message
            });
        }
    }

    /**
     * GET /api/v1/institution-rep/batches/:batchId/students/:studentId/academic-performance
     */
    async getAcademicPerformance(req, res) {
        try {
            const { batchId, studentId } = req.params;
            const institutionId = req.user.institution_id;
            const { page, limit, search, type } = req.query;

            const data = await batchStudentsService.getAcademicPerformance(batchId, studentId, institutionId, {
                page: page ? parseInt(page) : 1,
                limit: limit ? parseInt(limit) : 10,
                search,
                type: type || 'all'
            });

            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('getAcademicPerformance controller error:', error);
            
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal Server Error';

            return res.status(statusCode).json({
                success: false,
                message
            });
        }
    }
}

module.exports = new BatchStudentsController();
const batchesService = require('../../services/institutionRep/batches.service');
const batchExport = require('../../utils/fileGenerators/batchListExport');

class InstitutionRepBatchesController {
    /**
     * GET /api/v1/institution-rep/batches
     */
    async getBatches(req, res) {
        try {
            const institutionId = req.user.institution_id;
            const data = await batchesService.getBatches(req.query, institutionId);
            
            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('getBatches controller error:', error);
            return res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Internal Server Error'
            });
        }
    }

    /**
     * GET /api/v1/institution-rep/batches/download
     */
    async downloadBatches(req, res) {
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
            console.error('downloadBatches controller error:', error);
            if (!res.headersSent) {
                return res.status(error.statusCode || 500).json({
                    success: false,
                    message: error.message || 'Internal Server Error'
                });
            }
        }
    }


}

module.exports = new InstitutionRepBatchesController();
const dashboardService = require('../../services/institutionRep/dashboard.service');

class DashboardController {
    /**
     * Get dashboard stats for the institution
     */
    async getDashboardStats(req, res, next) {
        try {
            // institution_id is attached to req.user by institutionRepAuth middleware
            const institutionId = req.user.institution_id;
            
            const stats = await dashboardService.getStats(institutionId);

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('Error fetching dashboard stats:', error);
            next(error);
        }
    }

    /**
     * Get monitoring list (at-risk and warning students)
     */
    async getMonitoringList(req, res, next) {
        try {
            const institutionId = req.user.institution_id;
            const filters = {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 10,
                search: req.query.search || '',
                batch_id: req.query.batch_id || 'all'
            };

            const result = await dashboardService.getMonitoringList(institutionId, filters);

            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Error fetching monitoring list:', error);
            if (error.message === 'Unauthorized batch access') {
                return res.status(403).json({ success: false, message: error.message });
            }
            next(error);
        }
    }
}

module.exports = new DashboardController();
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
            console.error('Error in exportReport controller:', error);
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
const gradeDistributionService = require('../../services/institutionRep/grade-distribution.service');

/**
 * Controller for Grade Distribution Chart Data (Institution Representative)
 */
class GradeDistributionController {
    /**
     * GET /api/v1/institution-rep/batches/:batchId/grade-distribution
     * Protected by JWT and verified for institution access.
     */
    async getGradeDistribution(req, res) {
        try {
            const { batchId } = req.params;
            // Assumes req.user is populated by institutionRepAuth middleware
            const institutionId = req.user.institution_id;

            const distribution = await gradeDistributionService.getGradeDistribution(batchId, institutionId);

            return res.status(200).json({
                success: true,
                data: {
                    distribution
                }
            });
        } catch (error) {
            console.error('GradeDistributionController.getGradeDistribution error:', error);
            
            const statusCode = error.statusCode || 500;
            return res.status(statusCode).json({
                success: false,
                message: error.message || 'Internal Server Error'
            });
        }
    }
}

module.exports = new GradeDistributionController();
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

const downloadReport = async (req, res) => {
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
        console.error('Error downloading report:', error);
        if (!res.headersSent) {
            return res.status(500).json({
                success: false,
                message: 'Internal server error'
            });
        }
    }
};

module.exports = {
    getRecentReports,
    downloadReport
};
const studentPerformanceService = require('../../services/institutionRep/student-performance.service');

class StudentPerformanceController {
    /**
     * GET /api/v1/institution-rep/student-performance/summary
     */
    async getSummary(req, res) {
        try {
            const institutionId = req.user.institution_id;
            const term = req.query.term === 'past' ? 'past' : 'current';

            const data = await studentPerformanceService.getSummary(institutionId, term);

            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('getSummary controller error:', error);
            
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal Server Error';

            return res.status(statusCode).json({
                success: false,
                message
            });
        }
    }

    /**
     * GET /api/v1/institution-rep/student-performance/top-students
     */
    async getTopStudents(req, res) {
        try {
            const institutionId = req.user.institution_id;

            if (!institutionId) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden: Institution ID could not be resolved from token.'
                });
            }

            const data = await studentPerformanceService.getTopStudents(institutionId);

            return res.status(200).json({
                success: true,
                data
            });
        } catch (error) {
            console.error('getTopStudents controller error:', error);
            
            const statusCode = error.statusCode || 500;
            const message = error.message || 'Internal Server Error';

            return res.status(statusCode).json({
                success: false,
                message
            });
        }
    }
}

module.exports = new StudentPerformanceController();
