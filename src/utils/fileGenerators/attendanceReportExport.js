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
    async generatePDF(data, res) {
        const PDFDocument = require('pdfkit-table');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="attendance_report.pdf"');

        // Create a document
        const doc = new PDFDocument({ margin: 40, size: 'A4' });

        // Pipe its output to the response
        doc.pipe(res);

        // --- Brand Header ---
        doc.rect(0, 0, doc.page.width, 100).fill('#1E40AF'); // Deep Blue Header
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text('LMS PLATFORM', 40, 35);
        doc.fontSize(12).font('Helvetica').text('Student Attendance Report', 40, 65);
        
        // Date aligned to right in header
        doc.fontSize(10).text(`Date: ${new Date().toLocaleDateString()}`, doc.page.width - 150, 45, { align: 'right', width: 110 });

        // Reset text position after header
        doc.y = 130;
        doc.x = 40;

        // --- Student Info Section ---
        const studentName = data.length > 0 ? data[0].student_name : 'N/A';
        const studentEmail = data.length > 0 ? data[0].student_email : 'N/A';
        const totalSessions = data.length;
        const overallPercentage = data.length > 0 ? data[0].percentage : 0;

        // Box for student info
        doc.rect(40, doc.y, doc.page.width - 80, 70).fillAndStroke('#F3F4F6', '#E5E7EB');
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(14).text('Student Information', 55, doc.y + 15);
        
        doc.font('Helvetica').fontSize(10).fillColor('#374151');
        doc.text(`Name: ${studentName}`, 55, doc.y + 10);
        doc.text(`Email: ${studentEmail}`, 55, doc.y + 5);
        
        // Summary stats on the right side of the box
        doc.font('Helvetica-Bold').text(`Total Sessions: ${totalSessions}`, doc.page.width / 2, doc.y - 15);
        
        // Colored percentage
        let pctColor = overallPercentage >= 75 ? '#059669' : (overallPercentage >= 50 ? '#D97706' : '#DC2626');
        doc.font('Helvetica-Bold').fillColor('#374151').text(`Overall Attendance: `, doc.page.width / 2, doc.y + 5, { continued: true })
           .fillColor(pctColor).text(`${overallPercentage}%`);

        doc.moveDown(3);

        // --- Table Data ---
        doc.x = 40; // Reset X
        const table = {
            title: "Attendance Details",
            headers: [
                { label: "Date", property: 'attendance_date', width: 90, headerColor: '#2563EB', headerOpacity: 1, color: '#ffffff' },
                { label: "Batch", property: 'batch_name', width: 140, headerColor: '#2563EB', headerOpacity: 1, color: '#ffffff' },
                { label: "Course", property: 'course_name', width: 180, headerColor: '#2563EB', headerOpacity: 1, color: '#ffffff' },
                { label: "Status", property: 'status', width: 100, headerColor: '#2563EB', headerOpacity: 1, color: '#ffffff' }
            ],
            datas: data.length > 0 ? data.map(record => ({
                attendance_date: record.attendance_date || 'N/A',
                batch_name: record.batch_name || 'N/A',
                course_name: record.course_name || 'N/A',
                status: record.status ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : 'N/A'
            })) : [{ attendance_date: 'N/A', batch_name: 'No data', course_name: 'No data', status: 'N/A' }] // Empty state
        };

        await doc.table(table, {
            prepareHeader: () => doc.font("Helvetica-Bold").fontSize(11).fillColor('#ffffff'),
            prepareRow: (row, indexColumn, indexRow, rectRow, rectCell) => {
                doc.font("Helvetica").fontSize(10).fillColor('#1F2937');
                // Alternate row colors
                if (indexColumn === 0) {
                    doc.addBackground(rectRow, (indexRow % 2 ? '#F9FAFB' : '#FFFFFF'));
                }
                
                // Color code the status
                if (indexColumn === 3) {
                    if (row.status === 'Present') doc.fillColor('#059669'); // Green
                    else if (row.status === 'Absent') doc.fillColor('#DC2626'); // Red
                    else if (row.status === 'Late') doc.fillColor('#D97706'); // Orange
                }
            }
        });

        // Finalize the PDF and end the stream
        doc.end();
    }
}

module.exports = new AttendanceReportExport();
