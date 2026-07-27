const quizService = require('../src/services/quiz.service');
const studentPortalService = require('../src/services/student-portal.service');
const tutorPortalService = require('../src/services/tutor-portal.service');
const { Quiz, QuizQuestion, QuizSubmission, QuizAnswer, User, Student, Course, Enrollment } = require('../src/models');

async function runExplanationTests() {
    console.log('=== STARTING QUIZ EXPLANATION ENHANCEMENT TESTS ===\n');
    let createdQuizIds = [];

    try {
        // 1. Create Quiz with explanations
        console.log('Test 1: Create Quiz with per-question explanations...');
        const quizWithExp = await quizService.createQuiz({
            quiz_title: 'Test Quiz Explanation ' + Date.now(),
            total_marks: 10,
            questions: [
                {
                    question_text: 'What is 2 + 2?',
                    type: 'mcq',
                    options: ['3', '4', '5'],
                    correct_answer: '4',
                    marks: 5,
                    explanation: 'Because 2 plus 2 equals 4.'
                },
                {
                    question_text: 'Is JavaScript single-threaded?',
                    type: 'true_false',
                    options: ['true', 'false'],
                    correct_answer: 'true',
                    marks: 5,
                    explanation: 'JS uses a single event loop thread for execution.'
                }
            ]
        });
        createdQuizIds.push(quizWithExp.id);

        if (
            quizWithExp.questions[0].explanation === 'Because 2 plus 2 equals 4.' &&
            quizWithExp.questions[1].explanation === 'JS uses a single event loop thread for execution.'
        ) {
            console.log('✅ PASS: Quiz created with per-question explanations stored and returned correctly.');
        } else {
            console.error('❌ FAIL: Explanations not returned correctly on create:', quizWithExp.questions);
        }

        // 2. Create Quiz without explanations (Backward Compatibility)
        console.log('\nTest 2: Create Quiz without explanations (Backward Compatibility)...');
        const quizWithoutExp = await quizService.createQuiz({
            quiz_title: 'Legacy Style Quiz ' + Date.now(),
            total_marks: 5,
            questions: [
                {
                    question_text: 'Legacy Q1',
                    type: 'mcq',
                    options: ['A', 'B'],
                    correct_answer: 'A',
                    marks: 5
                }
            ]
        });
        createdQuizIds.push(quizWithoutExp.id);

        if (quizWithoutExp.questions[0].explanation === null) {
            console.log('✅ PASS: Legacy question without explanation returns explanation: null.');
        } else {
            console.error('❌ FAIL: Legacy question explanation was not null:', quizWithoutExp.questions[0]);
        }

        // 3. Edit Quiz (Modifying and preserving explanations)
        console.log('\nTest 3: Edit Quiz - updating explanation for Q1...');
        const updatedQuiz = await quizService.updateQuiz(quizWithExp.id, {
            quiz_title: quizWithExp.quiz_title,
            total_marks: 10,
            questions: [
                {
                    question_text: 'What is 2 + 2?',
                    type: 'mcq',
                    options: ['3', '4', '5'],
                    correct_answer: '4',
                    marks: 5,
                    explanation: 'Updated explanation for basic math.'
                },
                {
                    question_text: 'Is JavaScript single-threaded?',
                    type: 'true_false',
                    options: ['true', 'false'],
                    correct_answer: 'true',
                    marks: 5,
                    explanation: 'JS uses a single event loop thread for execution.'
                }
            ]
        });

        if (
            updatedQuiz.questions[0].explanation === 'Updated explanation for basic math.' &&
            updatedQuiz.questions[1].explanation === 'JS uses a single event loop thread for execution.'
        ) {
            console.log('✅ PASS: Quiz explanation updated successfully via updateQuiz.');
        } else {
            console.error('❌ FAIL: Explanation update failed:', updatedQuiz.questions);
        }

        // 4. Retrieve Quiz Details (getQuizById)
        console.log('\nTest 4: Retrieve Quiz Details (getQuizById)...');
        const retrieved = await quizService.getQuizById(quizWithExp.id);
        if (retrieved.questions && retrieved.questions.length === 2 && retrieved.questions[0].explanation) {
            console.log('✅ PASS: getQuizById returned all questions with explanation fields.');
        } else {
            console.error('❌ FAIL: getQuizById failed to return explanations:', retrieved);
        }

    } catch (err) {
        console.error('Unhandled error during test execution:', err);
    } finally {
        console.log('\nCleaning up test records...');
        for (const id of createdQuizIds) {
            await QuizQuestion.destroy({ where: { quiz_id: id } });
            await Quiz.destroy({ where: { id } });
        }
        console.log('Cleanup complete.');
        process.exit(0);
    }
}

runExplanationTests();
