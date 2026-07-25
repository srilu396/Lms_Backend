const studentService = require('../src/services/student.service');
const pdfHelper = require('../src/utils/fileGenerators/pdfExportHelper');
const batchListExport = require('../src/utils/fileGenerators/batchListExport');
const attendanceReportExport = require('../src/utils/fileGenerators/attendanceReportExport');
const exportReportService = require('../src/services/institutionRep/export-report.service');
const reportsService = require('../src/services/institutionRep/reports.service');
const { Writable } = require('stream');

class MemoryStream extends Writable {
    constructor() {
        super();
        this.chunks = [];
    }

    _write(chunk, encoding, callback) {
        this.chunks.push(chunk);
        callback();
    }

    getBuffer() {
        return Buffer.concat(this.chunks);
    }
}

class MockResponse extends MemoryStream {
    constructor() {
        super();
        this.headers = {};
        this.statusCode = 200;
        this.headersSent = false;
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

    json(obj) {
        this.setHeader('Content-Type', 'application/json');
        this.send(JSON.stringify(obj));
    }
}

async function verifyAllExports() {
    console.log('=== STARTING CSV & PDF EXPORT VERIFICATION ===\n');

    // 1. Verify Student CSV Template
    console.log('1. Testing Student CSV Template Generation...');
    const csvContent = await studentService.getBulkUploadTemplate();
    console.log('CSV Output Content Preview:');
    console.log(csvContent.trim());

    if (!csvContent.startsWith('first_name,last_name,email,mobile_number,password,status,institution')) {
        throw new Error('CSV Template headers mismatch!');
    }
    console.log('✔ Student CSV Template verification PASSED!\n');

    // 2. Test Batch List PDF Export Generator
    console.log('2. Testing Batch List PDF Generator...');
    const mockResBatchList = new MockResponse();
    const batchListPromise = new Promise((resolve) => mockResBatchList.on('finish', resolve));

    const dummyBatches = [
        {
            batch_id: 'B001',
            batch_code: 'B001',
            batch_name: 'Alpha Batch',
            course_name: 'Node.js Mastery',
            department: 'Computer Science',
            tutor: 'Dr. Smith',
            total_students: 25,
            progress_percentage: 85,
            status: 'active',
            institution_name: 'Tech University'
        },
        {
            batch_id: 'B002',
            batch_code: 'B002',
            batch_name: 'Beta Batch',
            course_name: 'React Deep Dive',
            department: 'Web Dev',
            tutor: 'Jane Doe',
            total_students: 30,
            progress_percentage: 90,
            status: 'active',
            institution_name: 'Tech University'
        }
    ];

    await batchListExport.generatePDF(dummyBatches, mockResBatchList);
    await batchListPromise;

    const pdfBuf1 = mockResBatchList.getBuffer();
    console.log(`PDF Buffer size: ${pdfBuf1.length} bytes`);
    console.log(`Content-Type Header: ${mockResBatchList.headers['content-type']}`);
    console.log(`Content-Disposition: ${mockResBatchList.headers['content-disposition']}`);

    if (pdfBuf1.length < 500 || pdfBuf1.toString('utf-8', 0, 5) !== '%PDF-') {
        throw new Error('Batch List PDF generation failed or generated invalid PDF header!');
    }
    console.log('✔ Batch List PDF Generator verification PASSED!\n');

    // 3. Test Attendance Report PDF Export Generator
    console.log('3. Testing Attendance Report PDF Generator...');
    const mockResAtt = new MockResponse();
    const attPromise = new Promise((resolve) => mockResAtt.on('finish', resolve));

    const dummyAtt = [
        {
            student_name: 'Alice Johnson',
            student_email: 'alice@example.com',
            attendance_date: '2026-07-20',
            batch_name: 'Alpha Batch',
            course_name: 'Node.js Mastery',
            status: 'present',
            percentage: 92
        }
    ];
    await attendanceReportExport.generatePDF(dummyAtt, mockResAtt);
    await attPromise;

    const pdfBuf2 = mockResAtt.getBuffer();
    console.log(`PDF Buffer size: ${pdfBuf2.length} bytes`);
    if (pdfBuf2.length < 500 || pdfBuf2.toString('utf-8', 0, 5) !== '%PDF-') {
        throw new Error('Attendance Report PDF generation failed!');
    }
    console.log('✔ Attendance Report PDF Generator verification PASSED!\n');

    console.log('=== ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
    process.exit(0);
}

verifyAllExports().catch(err => {
    console.error('VERIFICATION ERROR:', err);
    process.exit(1);
});
