const models = require('../src/models');
const { User, Tutor, Batch, Course, BatchTutor, Enrollment, Module, Topic, Lesson, Quiz, QuizSubmission, Assignment, BatchAssignment, AssignmentSubmission, AttendanceSession, StudentAttendance } = models;

async function seedTutorPortal() {
    try {
        console.log('--- Starting Tutor Portal Seed ---');
        
        // 1. Find a tutor user
        let user = await User.findOne({ where: { role: 'tutor' } });
        if (!user) {
            console.log('No tutor user found. Creating dummy tutor user...');
            user = await User.create({
                username: 'dummy_tutor',
                email: 'dummy_tutor@example.com',
                full_name: 'Dummy Tutor',
                role: 'tutor',
                password_hash: 'mock_hash',
                is_first_login: false
            });
        }
        
        // Ensure tutor profile exists
        let tutor = await Tutor.findOne({ where: { email: user.email } });
        if (!tutor) {
            console.log('No tutor profile found. Creating...');
            tutor = await Tutor.create({
                full_name: user.full_name,
                email: user.email,
                password: 'mock_hash',
                status: 'active'
            });
        }
        
        console.log(`Using Tutor: ${tutor.full_name} (Tutor ID: ${tutor.id})`);
        
        // 2. Course Structure
        let course = await Course.findOne({ where: { name: 'Full Stack Masterclass' } });
        if (!course) {
            course = await Course.create({
                name: 'Full Stack Masterclass',
                description: 'Complete curriculum for full stack',
                duration_months: 6,
                fee: 5000
            });
            console.log('Created dummy course ID:', course.id);
        }

        let cModule = await Module.findOne({ where: { course_id: course.id } });
        if (!cModule) {
            cModule = await Module.create({ course_id: course.id, name: 'React Basics', order_num: 1, description: 'Learn React' });
        }
        
        let topic = await Topic.findOne({ where: { module_id: cModule.id } });
        if (!topic) {
            topic = await Topic.create({ module_id: cModule.id, name: 'React Hooks', order_num: 1 });
        }
        
        // 3. Batch & BatchTutor
        let batch = await Batch.findOne({ where: { course_id: course.id } });
        if (!batch) {
            batch = await Batch.create({
                course_id: course.id,
                name: 'React Batch 2026',
                start_date: new Date(),
                end_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
                status: 'active'
            });
            console.log('Created dummy batch ID:', batch.id);
        }

        const [batchTutor, createdBT] = await BatchTutor.findOrCreate({
            where: { batch_id: batch.id, tutor_id: tutor.id },
            defaults: { is_primary: true }
        });
        if (createdBT) console.log('Assigned Tutor to Batch.');

        // 4. Student Enrollment
        let student = await User.findOne({ where: { email: 'student1@example.com' } });
        if (!student) {
            student = await User.create({
                username: 'student1', email: 'student1@example.com', full_name: 'Student One', role: 'student', password_hash: 'hash', is_first_login: false
            });
        }
        
        const [enrollment, createdEnrollment] = await Enrollment.findOrCreate({
            where: { student_id: student.id, batch_id: batch.id },
            defaults: { status: 'active', enrollment_date: new Date() }
        });
        if (createdEnrollment) console.log('Enrolled Student 1.');

        // 5. Quiz & Submission
        const [quiz, createdQuiz] = await Quiz.findOrCreate({
            where: { topic_id: topic.id },
            defaults: {
                name: 'React Hooks Quiz',
                instructions: 'Test your knowledge on React Hooks',
                time_limit_minutes: 15,
                passing_score: 50,
                total_marks: 100,
                status: 'published',
                is_published: true
            }
        });
        
        await QuizSubmission.findOrCreate({
            where: { student_id: student.id, quiz_id: quiz.id },
            defaults: {
                enrollment_id: enrollment.id,
                score: 85,
                status: 'completed',
                started_at: new Date(),
                completed_at: new Date()
            }
        });
        console.log('Created Quiz and Quiz Submission.');

        // 6. Assignment & Submission
        const [assignment, createdAssign] = await Assignment.findOrCreate({
            where: { course_id: course.id, title: 'Build a Todo App' },
            defaults: {
                description: 'Use React Hooks to build a Todo App',
                submission_type: 'link',
                max_score: 100
            }
        });

        // Link Assignment to Batch
        await BatchAssignment.findOrCreate({
            where: { assignment_id: assignment.id, batch_id: batch.id },
            defaults: { due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) }
        });

        await AssignmentSubmission.findOrCreate({
            where: { student_id: student.id, assignment_id: assignment.id },
            defaults: {
                enrollment_id: enrollment.id,
                status: 'submitted',
                submitted_at: new Date()
            }
        });
        console.log('Created Assignment and Assignment Submission.');

        // 7. Attendance
        const [session, createdSession] = await AttendanceSession.findOrCreate({
            where: { batch_id: batch.id, session_date: new Date().toISOString().split('T')[0] }
        });

        await StudentAttendance.findOrCreate({
            where: { student_id: student.id, session_id: session.id },
            defaults: {
                enrollment_id: enrollment.id,
                status: 'present',
                notes: 'Good'
            }
        });
        console.log('Created Attendance Session and Record.');

        console.log('--- Seeding Completed Successfully ---');
    } catch (err) {
        console.error('Seeding error:', err);
    }
}

seedTutorPortal();
