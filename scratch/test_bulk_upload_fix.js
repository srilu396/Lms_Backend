const fs = require('fs');
const path = require('path');
const studentService = require('../src/services/student.service');
const { connectDB } = require('../src/db/connect');

async function runTest() {
    try {
        await connectDB();
        // 1. Setup temp CSV
        const csvPath = path.join(__dirname, 'test_students.csv');
        const csvContent = 
`first_name,last_name,email,password,course_id,mobile_number,notes
Valid,Student,valid_test_${Date.now()}@example.com,password123,6,1234567890,Valid course
Invalid,Course,invalid_course_${Date.now()}@example.com,password123,99999,1234567891,Invalid course
Duplicate,Student,testanil01@gmail.com,password123,6,1234567892,Duplicate email
`;
        fs.writeFileSync(csvPath, csvContent);
        console.log('Test CSV created at:', csvPath);

        // 2. Run bulk upload
        console.log('Running bulk upload...');
        const result = await studentService.bulkUploadStudents(csvPath);
        
        console.log('Results:', JSON.stringify(result, null, 2));

        // 3. Assert expectations
        // Processed: 3
        // Inserted: 1 (the valid one)
        // Invalid courses ignored: 1 (the 99999 one)
        // Duplicates ignored: 1 (testanil01@gmail.com)
        
        if (result.processed === 3 && 
            result.inserted === 1 && 
            result.invalid_courses_ignored === 1 && 
            result.duplicates_ignored === 1) {
            console.log('SUCCESS: Fix verified!');
        } else {
            console.error('FAILURE: Result does not match expectations.');
        }

        // Cleanup
        if (fs.existsSync(csvPath)) fs.unlinkSync(csvPath);
        
        process.exit(0);
    } catch (error) {
        console.error('ERROR during test:', error);
        process.exit(1);
    }
}

runTest();
