const models = require('../src/models');
const { Quiz, QuizQuestion, QuizSubmission, QuizAnswer, User, Enrollment, Batch } = models;

async function seed() {
    try {
        // 1. Find user
        const user = await User.findOne({ where: { email: 'anil@gmail.com' } });
        if (!user) {
            console.log('User not found');
            return;
        }
        console.log('User ID:', user.id);

        // 2. Find or create enrollment
        let enrollment = await Enrollment.findOne({
            where: { student_id: user.id, status: 'active' }
        });
        
        if (!enrollment) {
            // Create a dummy batch and enrollment if none exists
            const batch = await Batch.findOne(); // Just get any batch
            if (!batch) {
                console.log('No batch found to link enrollment');
                return;
            }
            enrollment = await Enrollment.create({
                student_id: user.id,
                batch_id: batch.id,
                status: 'active',
                enrollment_date: new Date()
            });
            console.log('Created enrollment ID:', enrollment.id);
        } else {
            console.log('Using existing enrollment ID:', enrollment.id);
        }

        // 3. Find or create Quiz 18
        let quizId = 18;
        let quiz = await Quiz.findByPk(quizId);
        if (!quiz) {
            quiz = await Quiz.create({
                id: quizId,
                name: 'Test Quiz 18',
                time_limit_minutes: 15
            });
            console.log('Created Quiz 18');
        } else {
            console.log('Quiz 18 already exists');
        }

        // 4. Add questions to Quiz 18 if it has none
        const questionCount = await QuizQuestion.count({ where: { quiz_id: quizId } });
        if (questionCount === 0) {
            await QuizQuestion.bulkCreate([
                {
                    quiz_id: quizId,
                    question_text: 'What is the time complexity of Binary Search?',
                    options: ['O(n)', 'O(log n)', 'O(n^2)'],
                    correct_answer: 'O(log n)',
                    type: 'mcq', // Specify type to avoid not-null constraint error
                    marks: 1,
                    order_num: 1
                },
                {
                    quiz_id: quizId,
                    question_text: 'Which data structure uses LIFO?',
                    options: ['Queue', 'Stack', 'Linked List'],
                    correct_answer: 'Stack',
                    type: 'mcq',
                    marks: 1,
                    order_num: 2
                },
                {
                    quiz_id: quizId,
                    question_text: 'What does CPU stand for?',
                    options: ['Central Processing Unit', 'Central Process Unit', 'Computer Personal Unit'],
                    correct_answer: 'Central Processing Unit',
                    type: 'mcq',
                    marks: 1,
                    order_num: 3
                }
            ]);
            console.log('Added 3 questions to Quiz 18');
        } else {
            console.log('Quiz 18 already has questions');
        }

        // 5. Delete existing submission for this user on Quiz 18 to start fresh
        await QuizSubmission.destroy({
            where: { student_id: user.id, quiz_id: quizId }
        });
        console.log('Cleared existing submissions for User 31 on Quiz 18');

        // 6. Create a completed submission
        const submission = await QuizSubmission.create({
            student_id: user.id,
            quiz_id: quizId,
            enrollment_id: enrollment.id,
            attempt_number: 1,
            status: 'completed',
            score: 3,
            submitted_at: new Date()
        });
        console.log('Created completed submission ID:', submission.id);

        // 7. Add answers
        const questions = await QuizQuestion.findAll({ where: { quiz_id: quizId } });
        for (const q of questions) {
            await QuizAnswer.create({
                submission_id: submission.id,
                question_id: q.id,
                selected_answer: q.correct_answer, // All correct
                is_correct: true
            });
        }
        console.log('Added correct answers for the submission');

        console.log('Seeding completed successfully!');
    } catch (error) {
        console.error('Seeding failed:', error);
    }
}

seed();
