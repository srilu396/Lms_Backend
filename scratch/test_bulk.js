const BulkUploadService = require('../src/utils/batchBulkUpload/BulkUploadService');
const fs = require('fs');

async function run() {
    const csvContent = `name,course,institution,instructor,start_date,end_date,enroll_students,status
Test Batch 1,NonExistentCourse,MissingInst,MissingTutor,2026-01-01,2025-01-01,Anil,active
,ValidCourse,,ValidTutor,invalid_date,2027-01-01,,active`;

    fs.writeFileSync('test_bulk_temp.csv', csvContent);

    try {
        await BulkUploadService.processUpload('test_bulk_temp.csv', null);
        console.log('Upload succeeded.');
    } catch (e) {
        if (e.validationErrors) {
            console.log('Validation Errors Caught:', JSON.stringify(e.validationErrors, null, 2));
        } else {
            console.error('Other Error:', e);
        }
    } finally {
        if (fs.existsSync('test_bulk_temp.csv')) {
            fs.unlinkSync('test_bulk_temp.csv');
        }
        process.exit(0);
    }
}

run();
