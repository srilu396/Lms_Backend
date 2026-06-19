const fs = require('fs');
const path = require('path');
const batchService = require('./src/services/batch.service');
const { Institution, Course, Tutor, Student } = require('./src/models');

async function testUpload() {
    try {
        // Create dummy data to test
        const inst = await Institution.create({ name: 'ABC College Test', is_active: true });
        const course = await Course.create({ name: 'React Fundamentals Test', institution_id: inst.id, status: 'active' });
        const instructor = await Tutor.create({ full_name: 'John Doe Test', email: 'johndoe.test@example.com', status: 'active', password: 'password123' });
        const student1 = await Student.create({ first_name: 'Anil', last_name: 'Test', email: 'anil.test@example.com', institution_id: inst.id, status: 'active' });
        const student2 = await Student.create({ first_name: 'Naveen', email: 'naveen.test@example.com', institution_id: inst.id, status: 'active' });

        const csvContent = `name,course,institution,instructor,start_date,end_date,enroll_students,status
React Batch 01 Test,React Fundamentals Test,ABC College Test,John Doe Test,2026-04-01,2026-10-01,"Anil Test,Naveen",inactive`;

        const csvPath = path.join(__dirname, 'test_batch_upload.csv');
        fs.writeFileSync(csvPath, csvContent);

        console.log('Testing bulk upload...');
        const result = await batchService.bulkCreateBatchesFromCSV(csvPath, inst.id);
        console.log('Upload Result:', result);

        // Cleanup
        // In real app, we don't delete everything, but this shows success
        console.log('Test successful');
    } catch (e) {
        console.error('Test failed:', e.message);
    }
}

testUpload();
