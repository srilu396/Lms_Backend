const ExcelJS = require('exceljs');
const format = require('fast-csv').format;

/**
 * Utility to generate Student Attendance Report exports in CSV or Excel format
 */
class AttendanceReportExport {
    /**
     * Generate CSV and stream it to response
     */
    async generateCSV(data, res) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.csv');

        if (data.length === 0) {
            res.write('Student Name,Student Email,Batch Name,Course Name,Attendance Date,Status,Attendance Percentage\n');
            return res.end();
        }

        const csvStream = format({ headers: true });
        csvStream.pipe(res);

        data.forEach(record => {
            csvStream.write({
                'Student Name': record.student_name,
                'Student Email': record.student_email,
                'Batch Name': record.batch_name,
                'Course Name': record.course_name,
                'Attendance Date': record.attendance_date,
                'Status': record.status,
                'Attendance Percentage': `${record.percentage}%`
            });
        });

        csvStream.end();
    }

    /**
     * Generate Excel and stream it to response
     */
    async generateExcel(data, res) {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.xlsx');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance');

        worksheet.columns = [
            { header: 'Student Name', key: 'student_name', width: 25 },
            { header: 'Student Email', key: 'student_email', width: 30 },
            { header: 'Batch Name', key: 'batch_name', width: 25 },
            { header: 'Course Name', key: 'course_name', width: 30 },
            { header: 'Attendance Date', key: 'attendance_date', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Attendance Percentage', key: 'percentage', width: 25 }
        ];

        // Format headers
        worksheet.getRow(1).font = { bold: true };

        data.forEach(record => {
            worksheet.addRow({
                student_name: record.student_name,
                student_email: record.student_email,
                batch_name: record.batch_name,
                course_name: record.course_name,
                attendance_date: record.attendance_date,
                status: record.status,
                percentage: `${record.percentage}%`
            });
        });

        await workbook.xlsx.write(res);
        res.end();
    }

    /**
     * Generate PDF and stream it to response
     */
    /**
     * Generate PDF and stream it to response
     */
    async generatePDF(data, res) {
        const pdfHelper = require('./pdfExportHelper');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance_report.pdf"');

        // Create a document with bufferPages enabled
        const doc = pdfHelper.createDocument({ margin: 40, size: 'A4' });
        doc.pipe(res);

        const studentName = data.length > 0 ? (data[0].student_name || 'Student') : 'Student';

        pdfHelper.drawHeader(doc, {
            title: 'Student Attendance Report',
            organizationName: 'Transetu LMS',
            batchName: studentName,
            dateGenerated: new Date()
        });

        const studentEmail = data.length > 0 ? data[0].student_email : 'N/A';
        const totalSessions = data.length;
        const overallPercentage = data.length > 0 ? data[0].percentage : 0;

        // Box for student info
        doc.rect(30, doc.y, doc.page.width - 60, 50).fill(pdfHelper.colors.lightBg);
        doc.fillColor(pdfHelper.colors.text).font('Helvetica-Bold').fontSize(10);
        doc.text(`Student: ${studentName} (${studentEmail})`, 45, doc.y - 40);
        doc.text(`Total Sessions: ${totalSessions}  |  Overall Attendance: ${overallPercentage}%`, 45, doc.y - 25);

        doc.y += 15;

        // --- Table Data ---
        const table = {
            title: "Attendance History",
            headers: [
                { label: "Date", property: 'attendance_date', width: 90, headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                { label: "Batch", property: 'batch_name', width: 140, headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                { label: "Course", property: 'course_name', width: 185, headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                { label: "Status", property: 'status', width: 100, headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white }
            ],
            datas: data.length > 0 ? data.map(record => ({
                attendance_date: record.attendance_date || 'N/A',
                batch_name: record.batch_name || 'N/A',
                course_name: record.course_name || 'N/A',
                status: record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'N/A'
            })) : [{ attendance_date: 'N/A', batch_name: 'No data', course_name: 'No data', status: 'N/A' }]
        };

        await doc.table(table, {
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(9),
            prepareRow: (row, indexColumn, indexRow, rectRow) => {
                doc.font("Helvetica").fontSize(9);
                if (indexColumn === 0 && indexRow % 2 === 1) {
                    doc.addBackground(rectRow, pdfHelper.colors.lightBg);
                }
            }
        });

        pdfHelper.drawFooters(doc, 'Generated by LMS');
        doc.end();
    }
}

module.exports = new AttendanceReportExport();
