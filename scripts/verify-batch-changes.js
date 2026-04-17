const institutionRepBatchService = require('../src/services/institutionRep/batches.service');
const { Batch } = require('../src/models');

async function verify() {
    try {
        console.log('--- Verifying InstitutionRepBatchService ---');
        
        // 1. Check Filters
        console.log('\nChecking Filters...');
        const filters = await institutionRepBatchService.getFilterOptions(9); // Using institution_id 9 based on history
        console.log('Departments:', JSON.stringify(filters, null, 2));

        // 2. Check Listing
        console.log('\nChecking List (all)...');
        const allBatches = await institutionRepBatchService.getBatches({}, 9);
        console.log(`Total batches found: ${allBatches.batches.length}`);
        if(allBatches.batches.length > 0) {
            console.log('Sample batch department:', allBatches.batches[0].department);
        }

        // 3. Check Listing with Filter
        if (filters.departments.length > 0) {
            const dept = filters.departments[0];
            console.log(`\nChecking List with department: ${dept}...`);
            const filtered = await institutionRepBatchService.getBatches({ department: dept }, 9);
            console.log(`Batches found for ${dept}: ${filtered.batches.length}`);
            
            const allMatch = filtered.batches.every(b => b.department === dept || b.department.includes(dept));
            console.log('All batches match filter:', allMatch);
        }

        process.exit(0);
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

verify();
