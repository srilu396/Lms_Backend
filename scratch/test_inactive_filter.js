const { Domain } = require('../src/models');
const http = require('http');

function makeRequest(path) {
    return new Promise((resolve, reject) => {
        const req = http.get({
            hostname: 'localhost',
            port: 5002,
            path: path,
            headers: { 'Accept': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, raw: data });
                }
            });
        });
        req.on('error', reject);
    });
}

async function runTest() {
    try {
        console.log('--- Setting Domain #4 (UI/UX Design) to inactive ---');
        await Domain.update({ status: 'inactive' }, { where: { id: 4 } });

        console.log('\n=== GET /api/v1/domains/lookup ===');
        const lookupRes = await makeRequest('/api/v1/domains/lookup');
        console.log('Lookup Data:', JSON.stringify(lookupRes.body.data, null, 2));

        console.log('\n=== GET /api/v1/domains/filter ===');
        const filterRes = await makeRequest('/api/v1/domains/filter');
        console.log('Filter Data:', JSON.stringify(filterRes.body.data, null, 2));

    } finally {
        console.log('\n--- Restoring Domain #4 (UI/UX Design) back to active ---');
        await Domain.update({ status: 'active' }, { where: { id: 4 } });
        process.exit(0);
    }
}

runTest();
