const institutionRepBatchService = require('../src/services/institutionRep/batches.service');

async function verifyCombinedApi() {
    try {
        console.log('--- Phase 1: Test Combined Response Structure (with TitleCase params) ---');
        const query = { Page: 1, Limit: 10 };
        const result = await institutionRepBatchService.getBatches(query, 9);
        
        console.log('Response Keys:', Object.keys(result)); 
        console.log('Pagination:', JSON.stringify(result.pagination, null, 2));
        console.log('Filters:', JSON.stringify(result.filters, null, 2));
        
        if (result.batches.length > 0) {
            console.log('Sample Batch Structure:', Object.keys(result.batches[0]));
            console.log('Sample Batch Data:', JSON.stringify(result.batches[0], null, 2));
        } else {
            console.log('No batches found for institution 9');
        }

        console.log('\n--- Phase 2: Test Search (Batch Name) ---');
        const searchResult = await institutionRepBatchService.getBatches({ search: 'Batch' }, 9);
        console.log('Search matches (by name "Batch"):', searchResult.batches.length);

        console.log('\n--- Phase 3: Test Search (Tutor Name) ---');
        const tutorToSearch = result.batches[0]?.tutor;
        if (tutorToSearch && tutorToSearch !== 'Unassigned') {
            const tutorResult = await institutionRepBatchService.getBatches({ search: tutorToSearch }, 9);
            console.log(`Search matches (by tutor "${tutorToSearch}"):`, tutorResult.batches.length);
        } else {
            console.log('Skipping tutor search test (no tutor found)');
        }

        console.log('\n--- Phase 4: Test Department Filter ---');
        const deptToFilter = result.filters.departments[0];
        if (deptToFilter) {
            const deptResult = await institutionRepBatchService.getBatches({ department: deptToFilter }, 9);
            console.log(`Filter matches (by department "${deptToFilter}"):`, deptResult.batches.length);
            const allMatched = deptResult.batches.every(b => b.department === deptToFilter);
            console.log('All results match department:', allMatched);
        } else {
            console.log('Skipping department filter test (no departments found)');
        }

        process.exit(0);
    } catch (error) {
        console.error('Verification failed:', error);
        process.exit(1);
    }
}

verifyCombinedApi();
