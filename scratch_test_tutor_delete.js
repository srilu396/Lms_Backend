const tutorService = require('./src/services/tutor.service');

async function testTutorDelete() {
    try {
        console.log('Creating initial tutor...');
        const tutor1 = await tutorService.createTutor({
            full_name: 'Test Tutor Delete',
            email: 'deleteme@example.com',
            mobile_number: '1234567890',
            password: 'password123'
        });
        console.log('Created tutor ID:', tutor1.tutor_id);

        console.log('Setting status to inactive...');
        await tutorService.updateTutor(tutor1.tutor_id, { status: 'inactive' });

        console.log('Deleting tutor...');
        await tutorService.deleteTutor(tutor1.tutor_id);
        console.log('Tutor deleted successfully!');

        console.log('Attempting to create another tutor with identical email...');
        const tutor2 = await tutorService.createTutor({
            full_name: 'Test Tutor Delete 2',
            email: 'deleteme@example.com',
            mobile_number: '0987654321',
            password: 'password123'
        });
        console.log('Successfully created second tutor ID:', tutor2.tutor_id);

        console.log('Cleaning up by deactivating and deleting the second tutor...');
        await tutorService.updateTutor(tutor2.tutor_id, { status: 'inactive' });
        await tutorService.deleteTutor(tutor2.tutor_id);
        console.log('All tests passed natively! Unique constraints handled securely.');
    } catch (e) {
        console.error('Test Failed:', e);
    }
}

testTutorDelete();
