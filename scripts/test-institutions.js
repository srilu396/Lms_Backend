const fs = require('fs');

async function testInstitutions() {
    console.log('--- Testing Institutions API ---');
    const baseUrl = 'http://localhost:5000/api/institutions';
    
    // 1. Create
    console.log('1. Creating a new institution...');
    let res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Oxford Technical Institute',
            email: 'admin@oxford.edu',
            location: 'London, UK',
            contacts: [
                {
                    name: 'Alex Thompson',
                    email: 'alex.t@oxford.edu',
                    phone: '+44 20 1234 5678',
                    is_primary: true
                },
                {
                    name: 'Helena Vance',
                    email: 'helena.v@oxford.edu',
                    phone: '+44 20 7946 0958',
                    is_primary: false
                }
            ]
        })
    });
    
    let created = await res.json();
    console.log('Create Response:', created);

    if (!created.success) {
        console.error('Failed to create institution, aborting tests.');
        return;
    }

    const instId = created.data.id;

    // 2. List
    console.log('\n2. Listing institutions (search for Oxford)...');
    res = await fetch(`${baseUrl}?search=Oxford&page=1&limit=5`);
    let list = await res.json();
    console.log('List Response:', list);

    // Test Stats
    console.log('\n--- Testing Stats ---');
    let statsRes = await fetch(`${baseUrl}/stats`);
    let stats = await statsRes.json();
    console.log('Stats Response:', stats);

    // Test searching by INST-2024-ID
    console.log(`\n--- Testing Search ID ---`);
    let searchRes = await fetch(`${baseUrl}?search=INST-2024-${instId}`);
    let searchData = await searchRes.json();
    console.log(`Search ID Response (Expected ID ${instId}):`, searchData.data.map(d=>d.id));

    // 3. Update Status (Deactivate)
    console.log(`\n3. Deactivating institution ${instId}...`);
    res = await fetch(`${baseUrl}/${instId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false })
    });
    let statusUpdate = await res.json();
    console.log('Status Update Response:', statusUpdate);

    // 4. Update (Add another contact)
    console.log(`\n4. Updating institution ${instId} (adding 3rd contact)...`);
    res = await fetch(`${baseUrl}/${instId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Oxford Technical Institute Updated',
            email: 'admin.updated@oxford.edu',
            contacts: [
                ...created.data.InstitutionContacts,
                { name: 'Third Contact', email: 'third@oxford.edu' }
            ]
        })
    });
    let updated = await res.json();
    console.log('Update Response:', updated);

    // 5. Delete (Should succeed since inactive and no batches)
    console.log(`\n5. Deleting institution ${instId}...`);
    res = await fetch(`${baseUrl}/${instId}`, {
        method: 'DELETE'
    });
    let deleted = await res.json();
    console.log('Delete Response:', deleted);
}

testInstitutions().catch(console.error);
