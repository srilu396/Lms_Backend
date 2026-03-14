require('dotenv').config();
const { connectDB } = require('./src/db/connect');
const batchService = require('./src/services/batch.service');

async function testBatches() {
    await connectDB();
    try {
        console.log("Fetching batches...");
        const batches = await batchService.getBatches({});
        console.log(JSON.stringify(batches, null, 2));
    } catch (error) {
        console.error("Test Error:", error);
    }
    process.exit(0);
}

testBatches();
