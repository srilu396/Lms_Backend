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
        const pdfHelper = require('./pdfExportHelper');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename="batch_report.pdf"');

        const doc = pdfHelper.createDocument({ margin: 40, size: 'A4' });
        doc.pipe(res);

        const availableWidth = doc.page.width - 80;

        const institutionName = data.length > 0 ? (data[0].institution_name || 'Institution') : 'TRANSETU LMS';
        
        pdfHelper.drawHeader(doc, {
            title: 'Institution Batch Progress Report',
            organizationName: institutionName,
            dateGenerated: new Date()
        });

        // Summary Section Card
        const totalBatches = data.length;
        const totalActiveStudents = data.reduce((sum, b) => sum + (Number(b.total_students) || 0), 0);
        const avgProgress = totalBatches > 0 
            ? Math.round(data.reduce((sum, b) => sum + (Number(b.progress_percentage) || 0), 0) / totalBatches)
            : 0;

        pdfHelper.drawSummaryCard(doc, [
            { label: 'Total Batches', value: String(totalBatches) },
            { label: 'Total Active Students', value: String(totalActiveStudents) },
            { label: 'Average Progress %', value: `${avgProgress}%` }
        ]);

        if (data.length > 0) {
            // Table Data
            const table = {
                title: "Batch Details",
                headers: [
                    { label: "Batch Code", property: 'batch_code', width: availableWidth * 0.12, headerColor: '#1e293b', color: '#ffffff', align: 'left' },
                    { label: "Batch Name", property: 'batch_name', width: availableWidth * 0.23, headerColor: '#1e293b', color: '#ffffff', align: 'left' },
                    { label: "Course", property: 'course', width: availableWidth * 0.23, headerColor: '#1e293b', color: '#ffffff', align: 'left' },
                    { label: "Tutor", property: 'tutor', width: availableWidth * 0.17, headerColor: '#1e293b', color: '#ffffff', align: 'left' },
                    { label: "Total Students", property: 'students', width: availableWidth * 0.12, headerColor: '#1e293b', color: '#ffffff', align: 'right' },
                    { label: "Progress %", property: 'progress', width: availableWidth * 0.13, headerColor: '#1e293b', color: '#ffffff', align: 'right' }
                ],
                datas: data.map(batch => {
                    const rawCourse = batch.course_name || batch.course;
                    const courseName = (rawCourse && rawCourse !== 'N/A') ? rawCourse : 'N/A';
                    const rawTutor = batch.tutor || batch.assigned_tutor?.name;
                    const tutorName = (rawTutor && rawTutor !== 'Unassigned' && rawTutor !== 'N/A') ? rawTutor : 'N/A';

                    return {
                        batch_code: String(batch.batch_code || batch.batch_id || 'N/A'), 
                        batch_name: batch.batch_name || batch.name || 'N/A',
                        course: courseName,
                        tutor: tutorName,
                        students: String(batch.total_students || 0),
                        progress: `${batch.progress_percentage || 0}%`
                    };
                })
            };

            await doc.table(table, {
                x: 40,
                width: availableWidth,
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
                prepareRow: (row, indexColumn, indexRow, rectRow) => {
                    doc.font("Helvetica").fontSize(9);
                    if (indexColumn === 0 && indexRow % 2 === 1) {
                        doc.addBackground(rectRow, pdfHelper.colors.lightBg);
                    }
                }
            });
        } else {
            doc.font('Helvetica').fontSize(10).fillColor(pdfHelper.colors.subtext).text('No batches found.');
        }

        pdfHelper.drawFooters(doc, 'Generated by LMS');
        doc.end();
    }
}

module.exports = new BatchListExport();
