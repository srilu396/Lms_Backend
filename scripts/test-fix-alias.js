const institutionRepBatchService = require('../src/services/institutionRep/batches.service');

async function testFix() {
    try {
        console.log('Testing List Batches with department=CSM...');
        const res1 = await institutionRepBatchService.getBatches({ department: 'CSM' }, 9);
        console.log('Count:', res1.batches.length);

        console.log('\nTesting List Batches with filters=CSM...');
        const res2 = await institutionRepBatchService.getBatches({ filters: 'CSM' }, 9);
        console.log('Count:', res2.batches.length);

        console.log('\nTesting Get Filters with filters=CSM...');
        const res3 = await institutionRepBatchService.getFilterOptions(9, 'CSM');
        console.log('Departments:', JSON.stringify(res3.departments));

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

testFix();
