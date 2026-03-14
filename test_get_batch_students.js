require('dotenv').config();
const { connectDB } = require('./src/db/connect');
const batchService = require('./src/services/batch.service');

async function testGet() {
    await connectDB();
    try {
        console.log("Fetching students for batch 15...");
        const result = await batchService.getBatchStudents(15, {});
        console.log("Students:", JSON.stringify(result, null, 2));
    } catch (error) {
        console.error("Test Error:", error);
    }
    process.exit(0);
}

testGet();
