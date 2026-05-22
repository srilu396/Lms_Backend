require('dotenv').config();
const { connectDB } = require('./src/db/connect');
const batchService = require('./src/services/batch.service');

async function testUpload() {
    await connectDB();
    try {
        console.log("Uploading students...");
        const result = await batchService.bulkUploadStudentsToBatch(15, 'test_students.csv');
        console.log("Upload result:", result);
    } catch (error) {
        console.error("Test Error:", error);
    }
    process.exit(0);
}

testUpload();
