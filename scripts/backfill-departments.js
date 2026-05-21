const { Batch, Course, Domain } = require('../src/models');

async function backfillDepartments() {
    try {
        console.log('Starting backfill for departments...');
        
        const batches = await Batch.findAll({
            where: { department: null },
            include: [
                { 
                    model: Course, 
                    include: [{ model: Domain, as: 'domain' }] 
                }
            ]
        });

        console.log(`Found ${batches.length} batches to update.`);

        let updatedCount = 0;
        for (const batch of batches) {
            const domainName = batch.Course?.domain?.name || 'General';
            await batch.update({ department: domainName });
            updatedCount++;
            if (updatedCount % 10 === 0) {
                console.log(`Updated ${updatedCount} batches...`);
            }
        }

        console.log(`Backfill completed. Total updated: ${updatedCount}`);
        process.exit(0);
    } catch (error) {
        console.error('Error during backfill:', error);
        process.exit(1);
    }
}

backfillDepartments();
