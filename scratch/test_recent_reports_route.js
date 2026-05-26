const axios = require('axios');

async function verifyReportsRoute() {
    try {
        console.log("Logging in...");
        const loginRes = await axios.post('http://localhost:5000/auth/login', {
            email: 'kietwomens@gmail.com',
            password: 'P@55word'
        });
        const token = loginRes.data.accessToken || loginRes.data.token || (loginRes.data.data && loginRes.data.data.token) || loginRes.data.access_token || (loginRes.data.data && loginRes.data.data.access_token);
        console.log("Token obtained.");
        
        const headers = { Authorization: `Bearer ${token}` };
        
        console.log("\n--- Testing Recent Reports API ---");
        console.time("reports_duration");
        const reportsRes = await axios.get('http://localhost:5000/api/v1/institution-rep/reports/recent', { headers });
        console.timeEnd("reports_duration");
        console.log(JSON.stringify(reportsRes.data, null, 2));

    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
    }
}

verifyReportsRoute();
