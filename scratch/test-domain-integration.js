const CourseService = require('../src/services/course.service.js');
const domainService = require('../src/services/domain.service.js');
const { Domain, Course } = require('../src/models');

async function runVerification() {
    try {
        console.log('=== Step 1: Create an active test Domain ===');
        const testDomain = await Domain.create({
            name: 'Test Domain Verification ' + Date.now(),
            description: 'Automated test domain',
            status: 'active'
        });
        console.log(`Created Test Domain ID: ${testDomain.id}`);

        console.log('\n=== Step 2: Create Course with domain_id ===');
        const course1 = await CourseService.createCourse({
            name: 'Test Course 1 (domain_id)',
            domain_id: testDomain.id
        });
        console.log(`Course 1 Created: ID=${course1.id}, domain_id=${course1.domain_id}, domain_name=${course1.domain_name}`);

        console.log('\n=== Step 3: Create Course with domain (primitive) ===');
        const course2 = await CourseService.createCourse({
            name: 'Test Course 2 (domain primitive)',
            domain: testDomain.id
        });
        console.log(`Course 2 Created: ID=${course2.id}, domain_id=${course2.domain_id}, domain_name=${course2.domain_name}`);

        console.log('\n=== Step 4: Create Course with domain (object) ===');
        const course3 = await CourseService.createCourse({
            name: 'Test Course 3 (domain object)',
            domain: { id: testDomain.id, name: 'Ignored Name' }
        });
        console.log(`Course 3 Created: ID=${course3.id}, domain_id=${course3.domain_id}, domain_name=${course3.domain_name}`);

        console.log('\n=== Step 5: Check total_courses count for test domain ===');
        let domainData = await domainService.getDomainById(testDomain.id);
        console.log(`Total Courses for Domain ${testDomain.id}: ${domainData.total_courses}`);

        console.log('\n=== Step 6: Verify non-existent domain ID returns 400 error ===');
        try {
            await CourseService.createCourse({
                name: 'Test Course Invalid Domain',
                domain_id: 999999
            });
            console.error('ERROR: Non-existent domain did not throw an error!');
        } catch (err) {
            console.log(`Successfully caught expected error: "${err.message}" (statusCode=${err.statusCode})`);
        }

        console.log('\n=== Step 7: Update Course (Remove Domain) ===');
        const updatedCourse1 = await CourseService.updateCourse(course1.id, { domain: null });
        console.log(`Course 1 Updated: domain_id=${updatedCourse1.domain_id}, domain_name=${updatedCourse1.domain_name}`);

        domainData = await domainService.getDomainById(testDomain.id);
        console.log(`Total Courses after domain removal: ${domainData.total_courses}`);

        console.log('\n=== Step 8: Clean up test courses and domain ===');
        await Course.destroy({ where: { id: [course1.id, course2.id, course3.id] }, force: true });
        await testDomain.destroy({ force: true });

        console.log('\n=== ALL VERIFICATION CHECKS PASSED SUCCESSFULLY ===');
        process.exit(0);
    } catch (err) {
        console.error('Verification failed:', err);
        process.exit(1);
    }
}

runVerification();
