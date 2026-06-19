const batchService = require('../services/batch.service');

class BatchController {
    /**
     * POST /batches
     */
    async createBatch(req, res) {
        try {
            const data = { ...req.body };
            if (req.file) data.file_path = req.file.path;
            
            // Note: Validation is done in middleware
            const newBatch = await batchService.createBatch(data);
            
            // If file was provided, trigger bulk upload
            if (data.file_path) {
                try {
                    await batchService.bulkUploadStudentsToBatch(newBatch.id, data.file_path);
                } catch (bulkError) {
                }
            }

            res.status(201).json({
                success: true,
                message: 'Batch created successfully',
                data: newBatch
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * GET /batches
     */
    async getBatches(req, res) {
        try {
            const { page, limit, search, status, institution_id, course_id, tutor_id } = req.query;
            const result = await batchService.getBatches({
                page, limit, search, status, institution_id, course_id, tutor_id
            });
            res.status(200).json({
                success: true,
                data: result.batches,
                meta: {
                    total: result.totalCount,
                    page: result.currentPage,
                    totalPages: result.totalPages,
                    limit: limit ? parseInt(limit) : 10
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * GET /batches/:id
     */
    async getBatchById(req, res) {
        try {
            const { id } = req.params;
            const batch = await batchService.getBatchById(id);
            if (!batch) {
                return res.status(404).json({ success: false, message: 'Batch not found' });
            }
            res.status(200).json({
                success: true,
                data: batch
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * PUT /batches/:id
     */
    async updateBatch(req, res) {
        try {
            const { id } = req.params;
            const updatedBatch = await batchService.updateBatch(id, req.body);
            res.status(200).json({
                success: true,
                message: 'Batch updated successfully',
                data: updatedBatch
            });
        } catch (error) {
            if (error.message === 'Batch not found') {
                return res.status(404).json({ success: false, message: error.message });
            }
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * DELETE /batches/:id
     */
    async deleteBatch(req, res) {
        try {
            const { id } = req.params;
            const result = await batchService.deleteBatch(id);
            res.status(200).json({
                success: true,
                message: result.message
            });
        } catch (error) {
            if (error.message === 'Batch not found') {
                return res.status(404).json({ success: false, message: error.message });
            }
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * POST /batches/:id/tutors
     */
    async assignTutor(req, res) {
        try {
            const { id } = req.params;
            const { tutor_id, is_primary } = req.body;
            if (!tutor_id) return res.status(400).json({ success: false, message: 'tutor_id is required' });
            const result = await batchService.assignTutor(id, tutor_id, is_primary);
            res.status(201).json({
                success: true,
                message: 'Tutor assigned to batch successfully',
                data: result
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * GET /batches/:id/assignments
     */
    async getBatchAssignments(req, res) {
        try {
            const { id } = req.params;
            const assignments = await batchService.getBatchAssignments(id);
            res.status(200).json({
                success: true,
                data: assignments
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * GET /batches/:id/performance
     */
    async getBatchPerformance(req, res) {
        try {
            const { id } = req.params;
            const performance = await batchService.getBatchPerformance(id);
            res.status(200).json({
                success: true,
                data: performance
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * GET /batches/:id/students
     */
    async getBatchStudents(req, res) {
        try {
            const { id } = req.params;
            const { page, limit, status, search } = req.query;
            const result = await batchService.getBatchStudents(id, { page, limit, status, search });
            res.status(200).json({
                success: true,
                data: result.students,
                meta: {
                    total: result.total,
                    page: result.page,
                    limit: result.limit,
                    totalPages: result.totalPages
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * POST /batches/:id/students/bulk-upload
     */
    async bulkUploadStudentsToBatch(req, res) {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a valid CSV file' });
            const result = await batchService.bulkUploadStudentsToBatch(req.params.id, req.file.path);
            res.status(201).json({
                success: true,
                message: 'Bulk upload successful',
                data: result
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * GET /batches/stats
     */
    async getBatchStats(req, res) {
        try {
            const stats = await batchService.getBatchStats();
            res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }

    /**
     * GET /batches/bulk-upload/template
     */
    async downloadBatchTemplate(req, res) {
        try {
            const csvHeaders = 'name,course,institution,instructor,start_date,end_date,enroll_students,status\n';
            const csvSampleData = 'React Batch 01,React Fundamentals,ABC College,John Doe,2026-04-01,2026-10-01,"Anil,Naveen,Rahul",inactive\n';
            
            const csvContent = csvHeaders + csvSampleData;

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="batch_creation_upload_template.csv"');
            res.status(200).send(csvContent);
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error generating batch CSV template'
            });
        }
    }

    /**
     * GET /batches/:id/students/export-pdf
     */
    async exportBatchStudentsPDF(req, res) {
        try {
            const PDFDocument = require('pdfkit');
            const { id } = req.params;
            
            // Reusing getBatchStudents but without pagination just for the PDF export
            const result = await batchService.getBatchStudents(id, { limit: 10000, page: 1, ...req.query });

            const doc = new PDFDocument({ margin: 30 });

            res.setHeader('Content-disposition', `attachment; filename="batch_students_export.pdf"`);
            res.setHeader('Content-type', 'application/pdf');
            
            doc.pipe(res);

            // Title
            doc.fontSize(22).fillColor('#333333').text(`Batch Students Report`, { align: 'center' });
            doc.fontSize(14).fillColor('#666666').text(`Batch ID: #${id}`, { align: 'center' });
            doc.moveDown(2);

            // Table configuration
            const tableTop = 150;
            const headers = ['Full Name', 'Email', 'Status', 'Completion %'];
            const columnPositions = [50, 200, 380, 480];
            const columnWidths = [140, 170, 90, 70];
            const rowHeight = 25;

            // Draw header background
            doc.rect(50, tableTop - 5, 500, rowHeight).fill('#f0f0f0');

            // Draw headers
            doc.fillColor('#333333').font('Helvetica-Bold').fontSize(11);
            headers.forEach((header, i) => {
                doc.text(header, columnPositions[i], tableTop, { width: columnWidths[i], align: 'left' });
            });
            
            doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).strokeColor('#4a4a4a').lineWidth(1.5).stroke();

            // Draw rows
            doc.font('Helvetica').fontSize(10);
            let y = tableTop + 30;

            result.students.forEach((student, index) => {
                if (y > 700) {
                    doc.addPage();
                    y = 50;
                    
                    // Redraw headers on new page
                    doc.rect(50, y - 5, 500, rowHeight).fill('#f0f0f0');
                    doc.fillColor('#333333').font('Helvetica-Bold').fontSize(11);
                    headers.forEach((header, i) => {
                        doc.text(header, columnPositions[i], y, { width: columnWidths[i], align: 'left' });
                    });
                    doc.moveTo(50, y + 20).lineTo(550, y + 20).strokeColor('#4a4a4a').lineWidth(1.5).stroke();
                    y += 30;
                    doc.font('Helvetica').fontSize(10);
                }

                // Alternate row background colors
                if (index % 2 === 1) {
                    doc.rect(50, y - 5, 500, rowHeight).fill('#fafafa');
                    doc.fillColor('#333333');
                } else {
                    doc.fillColor('#333333');
                }

                doc.text(student.full_name || 'N/A', columnPositions[0], y, { width: columnWidths[0], ellipsis: true });
                doc.text(student.email || 'N/A', columnPositions[1], y, { width: columnWidths[1], ellipsis: true });
                
                // Color code the status
                if (student.status === 'active') doc.fillColor('#2e7d32');
                else doc.fillColor('#d32f2f');
                doc.text((student.status || 'N/A').toUpperCase(), columnPositions[2], y, { width: columnWidths[2] });
                
                // Content color default
                doc.fillColor('#333333');
                doc.text(`${student.completion_percentage || 0}%`, columnPositions[3], y, { width: columnWidths[3] });
                
                // Light border separator
                doc.moveTo(50, y + 20).lineTo(550, y + 20).strokeColor('#e0e0e0').lineWidth(0.5).stroke();
                y += rowHeight;
            });

            // Add footer with timestamp
            const pages = doc.bufferedPageRange();
            for (let i = 0; i < pages.count; i++) {
                doc.switchToPage(i);
                doc.moveTo(50, 750).lineTo(550, 750).strokeColor('#e0e0e0').lineWidth(1).stroke();
                doc.fontSize(8).fillColor('#999999').text(`Generated on: ${new Date().toLocaleString()}`, 50, 760);
                doc.text(`Page ${i + 1} of ${pages.count}`, 500, 760, { align: 'right' });
            }

            doc.end();

        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error exporting PDF'
            });
        }
    }

    /**
     * GET /batches/students/bulk-upload/template
     */
    async downloadBatchStudentTemplate(req, res) {
        try {
            const csvHeaders = 'student_id\n';
            const csvSampleData = '101\n102\n103\n';
            
            const csvContent = csvHeaders + csvSampleData;

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="batch_students_upload_template.csv"');
            res.status(200).send(csvContent);
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error generating CSV template'
            });
        }
    }

    /**
     * GET /batches/:id/stats
     */
    async getBatchStudentStats(req, res) {
        try {
            const { id } = req.params;
            const stats = await batchService.getSpecificBatchStats(id);
            res.status(200).json({
                success: true,
                data: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error getting batch stats'
            });
        }
    }

    /**
     * POST /batches/bulk-upload
     */
    async bulkCreateBatches(req, res) {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: 'Please upload a valid CSV file' });
            
            // institution_id might come from req.body if provided by admin
            const defaultInstitutionId = req.body.institution_id || null;
            
            const result = await batchService.bulkCreateBatchesFromCSV(req.file.path, defaultInstitutionId);
            res.status(201).json({
                success: true,
                message: 'Batches created successfully',
                data: result
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: error.message || 'Internal server error'
            });
        }
    }
}

module.exports = new BatchController();
