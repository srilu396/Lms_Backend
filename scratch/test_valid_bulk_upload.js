const { Institution, Course, Tutor, Student, Batch, sequelize } = require('../src/models');
const BulkUploadService = require('../src/utils/batchBulkUpload/BulkUploadService');
const fs = require('fs');

async function run() {
    try {
        console.log('Fetching active entities for test data...');
        // Find one active institution
        const inst = await Institution.findOne({ where: { is_active: true } });
        if (!inst) throw new Error('No active institution found');

        // Find one active course
        const course = await Course.findOne({ where: { status: 'active' } });
        if (!course) throw new Error('No active course found');

        // Find one active tutor
        const tutor = await Tutor.findOne({ where: { status: 'active' } });
        if (!tutor) throw new Error('No active tutor found');

        // Find a couple active students belonging to the institution (or update some to belong to it)
        let students = await Student.findAll({ where: { status: 'active', institution_id: inst.id }, limit: 2 });
        if (students.length === 0) {
            // Pick any active student and link to institution just for the test
            students = await Student.findAll({ where: { status: 'active' }, limit: 2 });
            for (let s of students) {
                await s.update({ institution_id: inst.id });
            }
        }
        if (students.length === 0) throw new Error('No active students found');

        const studentNames = students.map(s => `${s.first_name} ${s.last_name || ''}`.trim()).join(', ');

        const batchName = `Test Batch Automated ${Date.now()}`;
        
        const csvContent = `name,course,institution,instructor,start_date,end_date,enroll_students,status
${batchName},${course.name},${inst.name},${tutor.full_name},2027-01-01,2027-12-31,"${studentNames}",active`;

        console.log('Generated CSV Content:');
        console.log(csvContent);
        
        fs.writeFileSync('test_bulk_valid.csv', csvContent);

        console.log('Processing upload...');
        const result = await BulkUploadService.processUpload('test_bulk_valid.csv', null);
        console.log('Upload Result:', result);

        // Verify it was created
        const batch = await Batch.findOne({ where: { name: batchName } });
        if (batch) {
            console.log(`Success! Batch '${batch.name}' was created with unique_code: ${batch.unique_code}`);
        } else {
            console.log('Batch was not found in DB after success result.');
        }

    } catch (e) {
        if (e.validationErrors) {
            console.error('Validation Errors:', JSON.stringify(e.validationErrors, null, 2));
        } else {
            console.error('Error:', e);
        }
    } finally {
        if (fs.existsSync('test_bulk_valid.csv')) {
            fs.unlinkSync('test_bulk_valid.csv');
        }
        await sequelize.close();
        process.exit(0);
    }
}

run();
