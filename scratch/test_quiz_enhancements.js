const quizService = require('../src/services/quiz.service');
const { Quiz, QuizQuestion } = require('../src/models');

async function runTests() {
    console.log('=== STARTING QUIZ ENHANCEMENT TESTS ===\n');
    let createdQuizIds = [];

    try {
        // 1. Valid Quiz Creation
        console.log('Test 1: Create Quiz with valid per-question marks and matching sum...');
        const quiz1 = await quizService.createQuiz({
            quiz_title: 'Test Quiz Valid Marks ' + Date.now(),
            instructions: 'Test instructions',
            max_attempts: 2,
            duration: 30,
            total_marks: 20,
            passing_score: 10,
            domain: ['Tech'],
            tags: ['JS'],
            status: 'draft',
            shuffle_questions: true,
            questions: [
                { question_text: 'Q1', type: 'mcq', options: ['A', 'B'], correct_answer: 'A', marks: 10 },
                { question_text: 'Q2', type: 'mcq', options: ['A', 'B'], correct_answer: 'B', marks: 5 },
                { question_text: 'Q3', type: 'mcq', options: ['A', 'B'], correct_answer: 'A', marks: 5 }
            ]
        });
        createdQuizIds.push(quiz1.id);
        console.log('✅ PASS: Quiz 1 created successfully with ID:', quiz1.id);

        // 2. Create Quiz with 1 question
        console.log('\nTest 2: Create Quiz with 1 question...');
        const quiz2 = await quizService.createQuiz({
            quiz_title: 'Test Quiz Single Question ' + Date.now(),
            total_marks: 10,
            questions: [
                { question_text: 'Single Q', type: 'mcq', options: ['A', 'B'], correct_answer: 'A', marks: 10 }
            ]
        });
        createdQuizIds.push(quiz2.id);
        console.log('✅ PASS: Single question quiz created successfully with ID:', quiz2.id);

        // 3. Create Quiz with 100 questions
        console.log('\nTest 3: Create Quiz with 100 questions...');
        const q100 = Array.from({ length: 100 }, (_, i) => ({
            question_text: `Question ${i + 1}`,
            type: 'mcq',
            options: ['Opt A', 'Opt B'],
            correct_answer: 'Opt A',
            marks: 1
        }));
        const quiz3 = await quizService.createQuiz({
            quiz_title: 'Test Quiz 100 Questions ' + Date.now(),
            total_marks: 100,
            questions: q100
        });
        createdQuizIds.push(quiz3.id);
        console.log('✅ PASS: 100 question quiz created successfully with ID:', quiz3.id);

        // 4. Edit Quiz with valid new total_marks and question marks
        console.log('\nTest 4: Edit Quiz with valid new total_marks and question marks...');
        const updatedQuiz1 = await quizService.updateQuiz(quiz1.id, {
            quiz_title: 'Updated Test Quiz ' + Date.now(),
            total_marks: 25,
            passing_score: 15,
            questions: [
                { question_text: 'Updated Q1', type: 'mcq', options: ['A', 'B'], correct_answer: 'A', marks: 15 },
                { question_text: 'Updated Q2', type: 'mcq', options: ['A', 'B'], correct_answer: 'B', marks: 10 }
            ]
        });
        console.log('✅ PASS: Quiz updated successfully with total marks 25');

        // 5. Admin GET /quizzes/:id order check (Order preservation when shuffle_questions = true)
        console.log('\nTest 5: Verify Admin GET Quiz Details preserves original order even when shuffle_questions is true...');
        const retrievedQuiz = await quizService.getQuizById(quiz1.id);
        if (retrievedQuiz.questions[0].order_num === 1 && retrievedQuiz.questions[1].order_num === 2) {
            console.log('✅ PASS: Admin API returned questions in original saved order_num order.');
        } else {
            console.error('❌ FAIL: Questions were unexpectedly shuffled for admin details view');
        }

        // 6. Validation Error Cases
        console.log('\nTest 6: Testing validation failure cases...');

        const testCases = [
            {
                name: 'Missing question marks',
                data: { quiz_title: 'Fail Quiz', total_marks: 10, questions: [{ question_text: 'Q1', options: ['A'], correct_answer: 'A' }] },
                expectedMessage: 'must have a valid positive marks value'
            },
            {
                name: 'Marks equal to 0',
                data: { quiz_title: 'Fail Quiz', total_marks: 0, questions: [{ question_text: 'Q1', options: ['A'], correct_answer: 'A', marks: 0 }] },
                expectedMessage: 'Total marks must be a positive integer'
            },
            {
                name: 'Negative question marks',
                data: { quiz_title: 'Fail Quiz', total_marks: 10, questions: [{ question_text: 'Q1', options: ['A'], correct_answer: 'A', marks: -5 }] },
                expectedMessage: 'must be a positive integer'
            },
            {
                name: 'Decimal question marks',
                data: { quiz_title: 'Fail Quiz', total_marks: 10, questions: [{ question_text: 'Q1', options: ['A'], correct_answer: 'A', marks: 1.5 }, { question_text: 'Q2', options: ['A'], correct_answer: 'A', marks: 8.5 }] },
                expectedMessage: 'must be a positive integer'
            },
            {
                name: 'Passing score > total_marks',
                data: { quiz_title: 'Fail Quiz', total_marks: 20, passing_score: 25, questions: [{ question_text: 'Q1', options: ['A'], correct_answer: 'A', marks: 20 }] },
                expectedMessage: 'Passing score cannot exceed total marks'
            },
            {
                name: 'Missing total_marks',
                data: { quiz_title: 'Fail Quiz', questions: [{ question_text: 'Q1', options: ['A'], correct_answer: 'A', marks: 10 }] },
                expectedMessage: 'Total marks is required'
            },
            {
                name: 'Sum < total_marks',
                data: { quiz_title: 'Fail Quiz', total_marks: 25, questions: [{ question_text: 'Q1', options: ['A'], correct_answer: 'A', marks: 10 }, { question_text: 'Q2', options: ['A'], correct_answer: 'A', marks: 10 }] },
                expectedMessage: 'must equal the quiz total marks'
            },
            {
                name: 'Sum > total_marks',
                data: { quiz_title: 'Fail Quiz', total_marks: 15, questions: [{ question_text: 'Q1', options: ['A'], correct_answer: 'A', marks: 10 }, { question_text: 'Q2', options: ['A'], correct_answer: 'A', marks: 10 }] },
                expectedMessage: 'must equal the quiz total marks'
            },
            {
                name: 'Invalid data type for marks',
                data: { quiz_title: 'Fail Quiz', total_marks: 10, questions: [{ question_text: 'Q1', options: ['A'], correct_answer: 'A', marks: 'abc' }] },
                expectedMessage: 'must be a positive integer'
            },
            {
                name: 'Empty questions array',
                data: { quiz_title: 'Fail Quiz', total_marks: 10, questions: [] },
                expectedMessage: 'Questions array is required and cannot be empty'
            },
            {
                name: 'Question without options',
                data: { quiz_title: 'Fail Quiz', total_marks: 10, questions: [{ question_text: 'Q1', options: [], correct_answer: 'A', marks: 10 }] },
                expectedMessage: 'must have valid options'
            },
            {
                name: 'Question without correct answer',
                data: { quiz_title: 'Fail Quiz', total_marks: 10, questions: [{ question_text: 'Q1', options: ['A'], correct_answer: '', marks: 10 }] },
                expectedMessage: 'must have a correct answer'
            }
        ];

        for (const tc of testCases) {
            try {
                await quizService.createQuiz({
                    quiz_title: 'Title ' + Math.random(),
                    ...tc.data
                });
                console.error(`❌ FAIL: Scenario "${tc.name}" did not throw expected error!`);
            } catch (err) {
                if (err.message && err.message.includes(tc.expectedMessage)) {
                    console.log(`✅ PASS: Scenario "${tc.name}" correctly rejected: "${err.message}"`);
                } else {
                    console.error(`❌ FAIL: Scenario "${tc.name}" threw unexpected message: "${err.message}"`);
                }
            }
        }

    } catch (err) {
        console.error('Unhandled error during test execution:', err);
    } finally {
        // Cleanup created test records
        console.log('\nCleaning up created test records...');
        for (const id of createdQuizIds) {
            await QuizQuestion.destroy({ where: { quiz_id: id } });
            await Quiz.destroy({ where: { id } });
        }
        console.log('Cleanup complete.');
        process.exit(0);
    }
}

runTests();
