const jwt = require('jsonwebtoken');
const axios = require('axios');

async function testHttp() {
    try {
        const token = jwt.sign({ id: 31, role: 'student' }, process.env.JWT_SECRET || 'your_jwt_secret', { expiresIn: '1h' });
        const config = { headers: { 'Authorization': `Bearer ${token}` } };

        console.log("Making PUT request...");
        try {
            let putRes = await axios.put('http://localhost:5000/api/v1/student-portal/course/25/notes', {
                title: "My Http Note",
                content: "Updated via HTTP PUT AGAIN!"
            }, config);
            console.log("PUT Response:", putRes.data);
        } catch (e) {
            console.error("PUT Error:", e.response ? e.response.data : e.message);
        }

        console.log("Making GET request...");
        try {
            let getRes = await axios.get('http://localhost:5000/api/v1/student-portal/course/25/notes', config);
            console.log("GET Response:", getRes.data);
        } catch (e) {
            console.error("GET Error:", e.response ? e.response.data : e.message);
        }

    } catch (e) {
        console.error("Outer Error:", e.message);
    }
}

testHttp();
