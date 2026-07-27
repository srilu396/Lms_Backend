const quizService = require('../src/services/quiz.service');
const assignmentService = require('../src/services/assignment.service');

async function testLookups() {
    try {
        console.log('--- Testing Quiz Lookup ---');
        const quizResult = await quizService.getQuizLookup({ limit: 5 });
        console.log('Quiz Lookup Response:', JSON.stringify(quizResult, null, 2));

        if (quizResult.data && quizResult.data.length > 0) {
            const sampleQuiz = quizResult.data[0];
            const quizKeys = Object.keys(sampleQuiz);
            console.log('Quiz item keys:', quizKeys);
            console.assert(quizKeys.includes('id'), 'Quiz missing id');
            console.assert(quizKeys.includes('title'), 'Quiz missing title');
            console.assert(quizKeys.includes('duration'), 'Quiz missing duration');
            console.assert(quizKeys.includes('total_marks'), 'Quiz missing total_marks');
            console.assert(quizKeys.includes('questions_count'), 'Quiz missing questions_count');
            console.assert(!quizKeys.includes('description'), 'Quiz should not include description');
            console.assert(!quizKeys.includes('status'), 'Quiz should not include status');
        } else {
            console.log('No published quizzes found in test DB.');
        }

        console.log('\n--- Testing Assignment Lookup ---');
        const assignmentResult = await assignmentService.getAssignmentLookup({ limit: 5 });
        console.log('Assignment Lookup Response:', JSON.stringify(assignmentResult, null, 2));

        if (assignmentResult.data && assignmentResult.data.length > 0) {
            const sampleAssignment = assignmentResult.data[0];
            const assignmentKeys = Object.keys(sampleAssignment);
            console.log('Assignment item keys:', assignmentKeys);
            console.assert(assignmentKeys.includes('id'), 'Assignment missing id');
            console.assert(assignmentKeys.includes('title'), 'Assignment missing title');
            console.assert(assignmentKeys.includes('duration'), 'Assignment missing duration');
            console.assert(assignmentKeys.includes('total_marks'), 'Assignment missing total_marks');
            console.assert(!assignmentKeys.includes('description'), 'Assignment should not include description');
            console.assert(!assignmentKeys.includes('status'), 'Assignment should not include status');
        } else {
            console.log('No active assignments found in test DB.');
        }

        console.log('\nALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
        process.exit(0);
    } catch (error) {
        console.error('Lookup verification failed with error:', error);
        process.exit(1);
    }
}

testLookups();
