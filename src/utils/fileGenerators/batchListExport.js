const ExcelJS = require('exceljs');
const format = require('fast-csv').format;

/**
 * Utility to generate Batch List exports in CSV or Excel format
 */
class BatchListExport {
    /**
     * Generate CSV and stream it to response
     */
    async generateCSV(data, res) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=batches.csv');

        const csvStream = format({ headers: true });
        csvStream.pipe(res);

        data.forEach(batch => {
            csvStream.write({
                'Batch Code': batch.batch_code,
                'Batch Name': batch.batch_name,
                'Course': batch.course_name,
                'Department': batch.department,
                'Tutor': batch.assigned_tutor?.name || 'N/A',
                'Students': batch.total_students,
                'Progress %': `${batch.progress_percentage}%`,
                'Status': batch.status
            });
        });

        csvStream.end();
    }

    /**
     * Generate Excel and stream it to response
     */
    async generateExcel(data, res) {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=batches.xlsx');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Batches');

        worksheet.columns = [
            { header: 'Batch Code', key: 'batch_code', width: 20 },
            { header: 'Batch Name', key: 'batch_name', width: 25 },
            { header: 'Course', key: 'course_name', width: 30 },
            { header: 'Department', key: 'department', width: 20 },
            { header: 'Tutor', key: 'tutor_name', width: 25 },
            { header: 'Students', key: 'total_students', width: 10 },
            { header: 'Progress %', key: 'progress_percentage', width: 15 },
            { header: 'Status', key: 'status', width: 15 }
        ];

        // Format headers
        worksheet.getRow(1).font = { bold: true };

        data.forEach(batch => {
            worksheet.addRow({
                batch_code: batch.batch_code,
                batch_name: batch.batch_name,
                course_name: batch.course_name,
                department: batch.department,
                tutor_name: batch.assigned_tutor?.name || 'N/A',
                total_students: batch.total_students,
                progress_percentage: `${batch.progress_percentage}%`,
                status: batch.status
            });
        });

        await workbook.xlsx.write(res);
        res.end();
    }

    /**
     * Generate PDF and stream it to response
     */
    async generatePDF(data, res) {
        const PDFDocument = require('pdfkit-table');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="batch_report.pdf"');

        // Create a document
        const doc = new PDFDocument({ margin: 30, size: 'A4' });

        // Pipe its output to the response
        doc.pipe(res);

        // Header
        const institutionName = data.length > 0 ? data[0].institution_name : 'Institution';
        doc.fontSize(20).text('Institution Batch Progress Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).text(`Institution: ${institutionName}`, { align: 'center' });
        doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown(2);

        // Summary Section
        const totalBatches = data.length;
        const avgProgress = totalBatches > 0 
            ? Math.round(data.reduce((sum, b) => sum + (b.progress_percentage || 0), 0) / totalBatches)
            : 0;

        doc.fontSize(14).text('Summary', { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(11).text(`Total Batches: ${totalBatches}`);
        doc.text(`Average Progress: ${avgProgress}%`);
        doc.moveDown(2);

        // Table Data
        const table = {
            title: "Batch Details",
            headers: [
                { label: "Batch Code", property: 'batch_code', width: 80, headerColor: '#4F46E5', headerOpacity: 1, color: '#ffffff' },
                { label: "Batch Name", property: 'batch_name', width: 100, headerColor: '#4F46E5', headerOpacity: 1, color: '#ffffff' },
                { label: "Course", property: 'course', width: 100, headerColor: '#4F46E5', headerOpacity: 1, color: '#ffffff' },
                { label: "Tutor", property: 'tutor', width: 80, headerColor: '#4F46E5', headerOpacity: 1, color: '#ffffff' },
                { label: "Students", property: 'students', width: 50, headerColor: '#4F46E5', headerOpacity: 1, color: '#ffffff' },
                { label: "Progress", property: 'progress', width: 50, headerColor: '#4F46E5', headerOpacity: 1, color: '#ffffff' },
                { label: "Status", property: 'status', width: 60, headerColor: '#4F46E5', headerOpacity: 1, color: '#ffffff' },
            ],
            datas: data.map(batch => ({
                batch_code: batch.batch_id || batch.batch_code || 'N/A', 
                batch_name: batch.batch_name || 'N/A',
                course: `${batch.course_name || batch.course || 'N/A'}\n(${batch.department || 'N/A'})`,
                tutor: batch.tutor || batch.assigned_tutor?.name || 'N/A',
                students: String(batch.total_students || 0),
                progress: `${batch.progress_percentage || 0}%`,
                status: batch.status || batch.progress_status || 'N/A'
            }))
        };

        await doc.table(table, {
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
            prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                doc.font("Helvetica").fontSize(9);
                if (indexColumn === 0) {
                    doc.addBackground(rectRow, (indexRow % 2 ? '#f9fafb' : '#ffffff'));
                }
            }
        });

        // Finalize the PDF and end the stream
        doc.end();
    }
}

module.exports = new BatchListExport();
