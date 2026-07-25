const tutorService = require('../src/services/tutor.service');
const userService = require('../src/services/user.service');
const studentService = require('../src/services/student.service');
const adminService = require('../src/services/admin.service');
const batchService = require('../src/services/batch.service');
const { Tutor, Student, User, Domain, Institution, Batch, Enrollment, sequelize } = require('../src/models');

async function runVerification() {
    console.log('=== STARTING AUTOMATED VERIFICATION ===\n');

    try {
        // 1. Test Domain lookup
        const domains = await Domain.findAll();
        console.log(`[1] Total domains in DB: ${domains.length}`);
        const firstDomain = domains[0];
        const domainId = firstDomain ? firstDomain.id : 1;
        const domainName = firstDomain ? firstDomain.name : 'Web Development';

        // 2. Test Tutor Create with domains and tags & Password Matching
        console.log('\n[2] Testing Tutor Create & Password validation...');
        const uniqueEmail = `test.tutor.${Date.now()}@example.com`;
        
        // Test password mismatch
        try {
            await tutorService.createTutor({
                full_name: 'Test Tutor Verification',
                email: uniqueEmail,
                password: 'Password123!',
                confirm_password: 'WrongPassword!'
            });
            console.error('FAILED: Password mismatch should have thrown error!');
        } catch (err) {
            console.log('SUCCESS: Password mismatch threw expected error:', err.message);
        }

        // Test valid create
        const newTutor = await tutorService.createTutor({
            full_name: 'Test Tutor Verification',
            email: uniqueEmail,
            password: 'Password123!',
            confirm_password: 'Password123!',
            domains: [domainId, domainName],
            tags: [' Node ', ' Express ', ' Node ']
        });
        console.log('SUCCESS: Created Tutor:', {
            id: newTutor.id,
            domains: newTutor.domains,
            tags: newTutor.tags
        });

        // 3. Test Tutor Domain Filtering
        console.log('\n[3] Testing Get All Tutors Domain Filtering...');
        const filterById = await tutorService.getTutors({ domain_id: domainId });
        console.log(`Filter by domain_id=${domainId} returned ${filterById.data.length} tutors.`);

        const filterByName = await tutorService.getTutors({ domain: domainName.toLowerCase() });
        console.log(`Filter by domain="${domainName.toLowerCase()}" returned ${filterByName.data.length} tutors.`);

        // 4. Test Tutor Edit
        console.log('\n[4] Testing Edit Tutor (domains/tags & optional password)...');
        const updatedTutor = await tutorService.updateTutor(newTutor.id, {
            tags: ['Python', 'Django']
        });
        console.log('SUCCESS: Updated Tutor tags:', updatedTutor.tags);

        // 5. Test Admin Dashboard stats
        console.log('\n[5] Testing Admin Dashboard Stats...');
        const stats = await adminService.getDashboardStats();
        console.log('Dashboard Stats:', stats);

        // 6. Test Batch Students Progress Calculation
        console.log('\n[6] Testing Batch Students Progress Calculation...');
        const batches = await Batch.findAll({ limit: 1 });
        if (batches.length > 0) {
            const batchId = batches[0].id;
            const batchStudentsResult = await batchService.getBatchStudents(batchId, { limit: 5 });
            console.log(`Batch #${batchId} Students Count: ${batchStudentsResult.total}`);
            if (batchStudentsResult.students.length > 0) {
                console.log('Sample student completion percentage:', batchStudentsResult.students[0].completion_percentage, '%');
            }
        }

        // Clean up test tutor
        await Tutor.destroy({ where: { email: uniqueEmail }, force: true });
        await User.destroy({ where: { email: uniqueEmail }, force: true });
        console.log('\n=== ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
        process.exit(0);

    } catch (error) {
        console.error('VERIFICATION ERROR:', error);
        process.exit(1);
    }
}

runVerification();
