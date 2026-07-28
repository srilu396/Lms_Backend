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

async function verify() {
    console.log('=== VERIFYING GET /api/v1/domains/lookup ===');
    const lookupRes = await makeRequest('/api/v1/domains/lookup');
    console.log('Status Code:', lookupRes.statusCode);
    console.log('Lookup Output:', JSON.stringify(lookupRes.body, null, 2));

    console.log('\n=== VERIFYING GET /api/v1/domains/filter ===');
    const filterRes = await makeRequest('/api/v1/domains/filter');
    console.log('Status Code:', filterRes.statusCode);
    console.log('Filter Output:', JSON.stringify(filterRes.body, null, 2));
}

verify().catch(console.error);
