const studentService = require('../src/services/student.service');
const pdfHelper = require('../src/utils/fileGenerators/pdfExportHelper');
const batchListExport = require('../src/utils/fileGenerators/batchListExport');
const exportReportService = require('../src/services/institutionRep/export-report.service');
const reportsService = require('../src/services/institutionRep/reports.service');
const { Writable } = require('stream');

class MockResponse extends Writable {
    constructor() {
        super();
        this.chunks = [];
        this.headers = {};
        this.statusCode = 200;
    }

    _write(chunk, encoding, callback) {
        this.chunks.push(chunk);
        callback();
    }

    setHeader(key, val) {
        this.headers[key.toLowerCase()] = val;
    }

    status(code) {
        this.statusCode = code;
        return this;
    }

    send(content) {
        if (typeof content === 'string') {
            this.write(Buffer.from(content, 'utf-8'));
        } else {
            this.write(content);
        }
        this.end();
    }

    getBuffer() {
        return Buffer.concat(this.chunks);
    }
}

function verifyPdfBuffer(buffer, expectedName) {
    if (!buffer || buffer.length < 200) {
        throw new Error(`${expectedName}: PDF buffer is empty or too small (${buffer ? buffer.length : 0} bytes)`);
    }
    const headerStr = buffer.toString('utf-8', 0, 5);
    if (headerStr !== '%PDF-') {
        throw new Error(`${expectedName}: Invalid PDF header (received '${headerStr}')`);
    }
}

async function runVerification() {
    console.log('====================================================');
    console.log('  COMPREHENSIVE CSV & PDF EXPORT VERIFICATION TEST');
    console.log('====================================================\n');

    // 1. Verify Student CSV Template
    console.log('1. Testing Student CSV Template Generation...');
    const csvContent = await studentService.getBulkUploadTemplate();
    const expectedHeader = 'first_name,last_name,email,mobile_number,password,status,institution';
    if (!csvContent.startsWith(expectedHeader)) {
        throw new Error(`CSV Header mismatch!\nExpected: ${expectedHeader}\nGot: ${csvContent.slice(0, 70)}`);
    }
    console.log('✔ CSV Template content and headers verified successfully.\n');

    // 2. Test Batch List PDF Export Generator with Multiple Row Counts
    console.log('2. Testing Batch List PDF Generator across dataset sizes (0, 1, 10, 50 rows)...');
    const rowCounts = [0, 1, 10, 50];
    for (const count of rowCounts) {
        const mockRes = new MockResponse();
        const finishPromise = new Promise(resolve => mockRes.on('finish', resolve));

        const data = Array.from({ length: count }, (_, i) => ({
            batch_id: `B${i+1}`,
            batch_code: `CODE_${i+1}`,
            batch_name: `Batch ${i+1}`,
            course_name: 'Fullstack Web Dev',
            department: 'Computer Science',
            tutor: 'Dr. Alan Turing',
            total_students: 30,
            progress_percentage: 75,
            status: 'active',
            institution_name: 'Transetu University'
        }));

        await batchListExport.generatePDF(data, mockRes);
        await finishPromise;

        const buf = mockRes.getBuffer();
        verifyPdfBuffer(buf, `BatchList PDF (${count} rows)`);
        console.log(`  - ${count} rows => PDF Buffer: ${buf.length} bytes, Content-Type: ${mockRes.headers['content-type']}`);
    }
    console.log('✔ Batch List PDF export verified successfully across all dataset sizes.\n');

    // 3. Test Batch Students PDF Generator with Multiple Datasets
    console.log('3. Testing Batch Students PDF Generator directly...');
    for (const count of [0, 5, 25, 60]) {
        const doc = pdfHelper.createDocument({ margin: 30, size: 'A4' });
        const mockRes = new MockResponse();
        const finishPromise = new Promise(resolve => mockRes.on('finish', resolve));
        doc.pipe(mockRes);

        pdfHelper.drawHeader(doc, {
            title: 'Batch Students Report',
            organizationName: 'TRANSETU LMS',
            batchName: 'Test Batch #101',
            dateGenerated: new Date()
        });

        pdfHelper.drawSummaryCard(doc, [
            { label: 'Batch Name', value: 'Test Batch #101' },
            { label: 'Course', value: 'Node.js Backend' },
            { label: 'Total Enrolled', value: String(count) }
        ]);

        const students = Array.from({ length: count }, (_, i) => ({
            student_id: String(1000 + i),
            name: `Student ${i+1}`,
            email: `student${i+1}@example.com`,
            mobile: `98765432${i < 10 ? '0' + i : i}`,
            status: i % 5 === 0 ? 'INACTIVE' : 'ACTIVE',
            progress: `${Math.min(100, i * 2)}%`
        }));

        if (students.length > 0) {
            await doc.table({
                headers: [
                    { label: "Student ID", property: 'student_id', width: 60, headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: "Student Name", property: 'name', width: 110, headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: "Email", property: 'email', width: 145, headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: "Mobile", property: 'mobile', width: 85, headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: "Status", property: 'status', width: 65, headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: "Progress", property: 'progress', width: 70, headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white }
                ],
                datas: students
            }, {
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
                prepareRow: (row, indexColumn, indexRow, rectRow) => {
                    doc.font("Helvetica").fontSize(10);
                    if (indexColumn === 0 && indexRow % 2 === 1) {
                        doc.addBackground(rectRow, pdfHelper.colors.lightBg);
                    }
                }
            });
        } else {
            doc.font('Helvetica').fontSize(10).fillColor(pdfHelper.colors.subtext).text('No students enrolled in this batch.');
        }

        pdfHelper.drawFooters(doc, 'Generated by LMS');
        doc.end();

        await finishPromise;
        const buf = mockRes.getBuffer();
        verifyPdfBuffer(buf, `Batch Students PDF (${count} students)`);
        console.log(`  - ${count} students => PDF Buffer: ${buf.length} bytes, Pages: ${doc.bufferedPageRange().count}`);
    }
    console.log('✔ Batch Students PDF export verified successfully.\n');

    console.log('====================================================');
    console.log('  ALL EXPORT VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('====================================================\n');
}

runVerification().catch(err => {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
});
