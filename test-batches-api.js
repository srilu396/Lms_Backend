const axios = require('axios');
const fs = require('fs');

async function verifyBatches() {
    try {
        console.log("Logging in with kietwomens@gmail.com...");
        const loginRes = await axios.post('http://localhost:5000/auth/login', {
            email: 'kietwomens@gmail.com',
            password: 'P@55word'
        });
        const token = loginRes.data.accessToken || loginRes.data.token || (loginRes.data.data && loginRes.data.data.token) || loginRes.data.access_token || (loginRes.data.data && loginRes.data.data.access_token);
        console.log("Token obtained.");
        
        const headers = { Authorization: `Bearer ${token}` };
        
        console.log("\n--- Testing Batch List API ---");
        const listRes = await axios.get('http://localhost:5000/api/v1/institution-rep/batches?Page=1&Limit=10&Filter=&Search=', { headers });
        console.log(JSON.stringify(listRes.data, null, 2));

        if (listRes.data.data.batches.length > 0) {
            const batchId = listRes.data.data.batches[0].id;
            console.log(`\n--- Testing View Details API for Batch ${batchId} ---`);
            const detailsRes = await axios.get(`http://localhost:5000/api/v1/institution-rep/batches/${batchId}/overview`, { headers });
            console.log(JSON.stringify(detailsRes.data, null, 2));
        }
        
        console.log("\n--- Testing Download Batch List API (PDF) ---");
        const pdfRes = await axios.get('http://localhost:5000/api/v1/institution-rep/batches/download?format=pdf', { 
            headers,
            responseType: 'stream'
        });
        
        const writer = fs.createWriteStream('batch_report_test.pdf');
        pdfRes.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        
        console.log("PDF downloaded successfully to batch_report_test.pdf");

    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
    }
}

verifyBatches();
