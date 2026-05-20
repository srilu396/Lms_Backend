const axios = require('axios');

async function verify() {
    try {
        console.log("Logging in...");
        const loginRes = await axios.post('http://localhost:5000/auth/login', {
            email: 'kietwomens@gmail.com',
            password: 'P@55word'
        });
        const token = loginRes.data.accessToken || loginRes.data.token || (loginRes.data.data && loginRes.data.data.token) || loginRes.data.access_token || (loginRes.data.data && loginRes.data.data.access_token);
        console.log("Token obtained.");
        
        const headers = { Authorization: `Bearer ${token}` };
        
        console.log("\n--- Testing Dashboard Stats API ---");
        const statsRes = await axios.get('http://localhost:5000/api/v1/institution-rep/dashboard/stats', { headers });
        console.log(JSON.stringify(statsRes.data, null, 2));
        
        console.log("\n--- Testing Monitoring List API ---");
        const listRes = await axios.get('http://localhost:5000/api/v1/institution-rep/dashboard/monitoring-list?page=1&limit=10', { headers });
        console.log(JSON.stringify(listRes.data, null, 2));

    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
    }
}

verify();
