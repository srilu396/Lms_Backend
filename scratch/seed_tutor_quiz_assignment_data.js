/**
 * Comprehensive seed script for Tutor Portal Quiz & Assignment testing.
 * Seeds 5 students into tutor batches with quiz submissions and assignment submissions.
 * Correctly maps Students (students table) and Users (users table).
 * Also seeds Quiz Questions and Quiz Answers matching the mockup exactly.
 */

const models = require('../src/models');
const { Student, User, Enrollment, Quiz, QuizQuestion, QuizSubmission, QuizAnswer, Assignment, BatchAssignment, AssignmentSubmission } = models;

const STUDENT_SEEDS = [
    { username: 'quiz_student_1', email: 'quiz_student1@test.com', first_name: 'Rajesh', last_name: 'Kumar', full_name: 'Rajesh Kumar' },
    { username: 'quiz_student_2', email: 'quiz_student2@test.com', first_name: 'Priya', last_name: 'Sharma', full_name: 'Priya Sharma' },
    { username: 'quiz_student_3', email: 'quiz_student3@test.com', first_name: 'Amit', last_name: 'Patel', full_name: 'Amit Patel' },
    { username: 'quiz_student_4', email: 'quiz_student4@test.com', first_name: 'Sneha', last_name: 'Reddy', full_name: 'Sneha Reddy' },
    { username: 'quiz_student_5', email: 'quiz_student5@test.com', first_name: 'Vikram', last_name: 'Singh', full_name: 'Vikram Singh' },
];

async function seed() {
    try {
        console.log('=== Starting comprehensive quiz & assignment seed ===\n');

        const studentsList = [];
        
        // ─── 1. Create matching Student & User accounts ───────────────────
        for (const s of STUDENT_SEEDS) {
            const [user] = await User.findOrCreate({
                where: { email: s.email },
                defaults: {
                    username: s.username,
                    email: s.email,
                    full_name: s.full_name,
                    role: 'student',
                    password_hash: '$2a$10$7Z25QxK3CjI1K7F/jUvF3.W7kZgGvH8O8rJ95XhO2.z8s7i4h2Eie', // 'password'
                    is_first_login: false
                }
            });

            const [student] = await Student.findOrCreate({
                where: { email: s.email },
                defaults: {
                    first_name: s.first_name,
                    last_name: s.last_name,
                    email: s.email,
                    mobile_number: '1234567890',
                    password: '$2a$10$7Z25QxK3CjI1K7F/jUvF3.W7kZgGvH8O8rJ95XhO2.z8s7i4h2Eie', // 'password'
                    status: 'active'
                }
            });

            studentsList.push({ user, student });
        }
        console.log(`  Seeded ${studentsList.length} Student and User accounts.`);

        // ─── 2. Enroll students into Batch 26 & 30 (Tutor 14) ────────────
        const TARGET_BATCHES = [26, 30]; // Batch 26 (Course 10), Batch 30 (Course 12)

        for (const batchId of TARGET_BATCHES) {
            for (const { student } of studentsList) {
                await Enrollment.findOrCreate({
                    where: { student_id: student.id, batch_id: batchId },
                    defaults: { status: 'active', enrollment_date: new Date() }
                });
            }
        }
        console.log(`  Enrolled students into batches.`);

        // ─── 3. Clean up Quiz 18 data carefully to prevent FK errors ────────
        const existingSubmissions = await QuizSubmission.findAll({ where: { quiz_id: 18 } });
        const existingSubIds = existingSubmissions.map(s => s.id);

        if (existingSubIds.length > 0) {
            await QuizAnswer.destroy({ where: { submission_id: existingSubIds } });
            await QuizSubmission.destroy({ where: { id: existingSubIds } });
        }

        await QuizQuestion.destroy({ where: { quiz_id: 18 } });

        // ─── 4. Seed Quiz Questions for Quiz 18 (Matching mockup) ──────────
        const questionsData = [
            {
                quiz_id: 18,
                question_text: 'What is the main purpose of React Hooks?',
                options: ['To create global CSS styles', 'To use state and other React features in functional components', 'To replace JavaScript with HTML'],
                correct_answer: 'To use state and other React features in functional components',
                type: 'mcq',
                marks: 25,
                order_num: 1
            },
            {
                quiz_id: 18,
                question_text: 'Which method is used to update the state in a class component?',
                options: ['this.state = {}', 'this.setState()', 'updateState()'],
                correct_answer: 'this.setState()',
                type: 'mcq',
                marks: 25,
                order_num: 2
            },
            {
                quiz_id: 18,
                question_text: 'What does JSX stand for?',
                options: ['JavaScript XML', 'Java Syntax Extension'],
                correct_answer: 'JavaScript XML',
                type: 'mcq',
                marks: 25,
                order_num: 3
            },
            {
                quiz_id: 18,
                question_text: 'Which hook is used for side effects in functional components?',
                options: ['useEffect()', 'useSideEffect()'],
                correct_answer: 'useEffect()',
                type: 'mcq',
                marks: 25,
                order_num: 4
            }
        ];

        const questions = [];
        for (const q of questionsData) {
            const question = await QuizQuestion.create(q);
            questions.push(question);
        }
        console.log('  Seeded 4 questions for Quiz 18 (Total marks: 100).');

        await Quiz.update({ total_marks: 100, passing_score: 50 }, { where: { id: 18 } });

        // ─── 5. Quiz Submissions & Answers for Batch 26 (Quiz 18) ────────
        const batch26Enrollments = await Enrollment.findAll({
            where: { batch_id: 26, student_id: studentsList.map(item => item.student.id) }
        });

        const answersTemplate = [
            [true, true, true, false],   // Rajesh
            [true, false, true, false],  // Priya
            [true, true, true, true],    // Amit
            [true, true, true, false],   // Sneha
            [true, false, true, false],  // Vikram
        ];

        for (let i = 0; i < studentsList.length; i++) {
            const { user, student } = studentsList[i];
            const enrollment = batch26Enrollments.find(e => Number(e.student_id) === Number(student.id));
            if (!enrollment) {
                console.log(`    Enrollment not found for student ${student.id} (${student.first_name})`);
                continue;
            }

            const studentAnswers = answersTemplate[i];
            let score = 0;

            const submission = await QuizSubmission.create({
                student_id: user.id, // QuizSubmission references User.id
                quiz_id: 18,
                enrollment_id: enrollment.id,
                attempt_number: 1,
                status: 'completed',
                submitted_at: new Date(),
                created_at: new Date(Date.now() - 15 * 60 * 1000)
            });

            for (let qIdx = 0; qIdx < questions.length; qIdx++) {
                const question = questions[qIdx];
                const isCorrect = studentAnswers[qIdx];
                const selected = isCorrect 
                    ? question.correct_answer 
                    : question.options.find(opt => opt !== question.correct_answer);

                if (isCorrect) {
                    score += question.marks;
                }

                await QuizAnswer.create({
                    submission_id: submission.id,
                    question_id: question.id,
                    selected_answer: selected,
                    is_correct: isCorrect,
                    answered_at: new Date()
                });
            }

            await submission.update({ score });
            console.log(`  Created submission for ${user.full_name}: Score ${score}/100`);
        }

        // ─── 6. Assignments Submissions for Batch 30 (Assignments 8, 9) ───
        const assignmentStatuses = ['graded', 'graded', 'submitted', 'graded', 'submitted'];
        const assignmentGrades = [85, 72, null, 90, null];
        
        const batch30Enrollments = await Enrollment.findAll({
            where: { batch_id: 30, student_id: studentsList.map(item => item.student.id) }
        });

        await AssignmentSubmission.destroy({ where: { student_id: studentsList.map(item => item.user.id), assignment_id: [8, 9] } });

        for (let i = 0; i < studentsList.length; i++) {
            const { user, student } = studentsList[i];
            const enrollment = batch30Enrollments.find(e => Number(e.student_id) === Number(student.id));
            if (!enrollment) continue;

            for (const assignmentId of [8, 9]) {
                await AssignmentSubmission.create({
                    student_id: user.id, // AssignmentSubmission references User.id
                    assignment_id: assignmentId,
                    enrollment_id: enrollment.id,
                    status: assignmentStatuses[i],
                    grade: assignmentGrades[i],
                    submitted_at: new Date()
                });
            }
        }

        console.log('\n=== Seed completed successfully! ===');
        process.exit(0);
    } catch (err) {
        console.error('Seed error:', err);
        process.exit(1);
    }
}

seed();
