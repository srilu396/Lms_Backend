const institutionRepBatchService = require('../src/services/institutionRep/batches.service');

async function testFilter() {
    try {
        console.log('Testing with department=CSM...');
        const result = await institutionRepBatchService.getBatches({ department: 'CSM' }, 9);
        console.log('Total batches returned:', result.batches.length);
        console.log('Departments in result:', result.batches.map(b => b.department));

        console.log('\nTesting with filters=CSM (simulating user query)...');
        // Actually I need to check if my service handles 'filters' key
        const result2 = await institutionRepBatchService.getBatches({ filters: 'CSM' }, 9);
        console.log('Total batches returned with filters key:', result2.batches.length);
        
        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

testFilter();
