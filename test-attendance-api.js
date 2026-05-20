const axios = require('axios');

async function testAPI() {
    try {
        const loginRes = await axios.post('http://localhost:5000/auth/login', {
            email: 'kietwomens@gmail.com',
            password: 'P@55word'
        });
        const token = loginRes.data.accessToken;

        const calRes = await axios.get(
            'http://localhost:5000/api/v1/institution-rep/batches/8/students/48/attendance-calendar?month=2026-02',
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log(JSON.stringify(calRes.data, null, 2));
    } catch (e) {
        console.error(e.response ? e.response.data : e.message);
    }
}
testAPI();
