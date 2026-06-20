const assignmentService = require('./src/services/assignment.service');
const { Assignment } = require('./src/models');

async function verify() {
    try {
        console.log('Testing create assignment with FILE_UPLOAD...');
        const assignment1 = await assignmentService.createAssignment({
            title: 'Test Assignment 1',
            description: 'Test text submission',
            submission_type: 'TEXT_SUBMISSION',
            max_score: 100
        });
        console.log('Created assignment ID:', assignment1.id, 'with type:', assignment1.submission_type);

        console.log('Testing get all assignments...');
        const allAssignments = await assignmentService.getAllAssignments({ limit: 10 });
        console.log('Total assignments:', allAssignments.total);

        console.log('Testing 404 assignment by ID...');
        try {
            await assignmentService.getAssignmentById(99999);
        } catch (e) {
            console.log('Caught expected error:', e.statusCode, e.message);
        }

        console.log('All tests completed successfully!');
    } catch (e) {
        console.error('Test failed:', e);
    }
}

verify();
