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
}

module.exports = new BatchListExport();
