const axios = require('axios');
const fs = require('fs');

async function verifyExport() {
    try {
        console.log("Logging in...");
        const loginRes = await axios.post('http://localhost:5000/auth/login', {
            email: 'kietwomens@gmail.com',
            password: 'P@55word'
        });
        const token = loginRes.data.accessToken || loginRes.data.token || (loginRes.data.data && loginRes.data.data.token) || loginRes.data.access_token || (loginRes.data.data && loginRes.data.data.access_token);
        console.log("Token obtained.");
        
        const headers = { Authorization: `Bearer ${token}` };
        
        console.log("\n--- Testing Export Batch Report API (PDF) ---");
        console.time("export_duration");
        const pdfRes = await axios.get('http://localhost:5000/api/v1/institution-rep/batches/8/export-report', { 
            headers,
            responseType: 'stream'
        });
        
        const writer = fs.createWriteStream('batch_8_report_test.pdf');
        pdfRes.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
        console.timeEnd("export_duration");
        console.log("PDF downloaded successfully to batch_8_report_test.pdf");

    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
    }
}

verifyExport();
