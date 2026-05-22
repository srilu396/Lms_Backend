const { 
    Institution, 
    User, 
    Batch, 
    Enrollment, 
    Quiz, 
    QuizSubmission, 
    Student,
    sequelize 
} = require('../src/models');
const bcrypt = require('bcryptjs');

async function seed() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // 1. Create or Find Institution
        let institution = await Institution.findOne({ where: { name: 'Performance Test University' } });
        if (!institution) {
            institution = await Institution.create({
                name: 'Performance Test University',
                description: 'A university for testing student performance APIs',
                email: 'test_perf@university.com',
                is_active: true
            });
        }
        console.log('Institution:', institution.id);

        // 2. Create or Find Institution Representative
        const hashedPassword = bcrypt.hashSync('password123', 10);
        let rep = await User.findOne({ where: { email: 'rep_perf@test.com' } });
        if (!rep) {
            rep = await User.create({
                username: 'rep_perf_' + Date.now(),
                email: 'rep_perf@test.com',
                full_name: 'Performance Rep',
                role: 'institution_representative',
                password_hash: hashedPassword,
                institution_id: institution.id,
                is_active: true,
                is_first_login: false
            });
        } else {
            await rep.update({ institution_id: institution.id });
        }
        console.log('Institution Rep:', rep.id);

        // 3. Create a Batch
        const today = new Date();
        const tenDaysAgo = new Date(today);
        tenDaysAgo.setDate(today.getDate() - 10);
        const tenDaysFromNow = new Date(today);
        tenDaysFromNow.setDate(today.getDate() + 10);

        let batch = await Batch.findOne({ where: { name: 'Performance Test Batch' } });
        if (!batch) {
            batch = await Batch.create({
                name: 'Performance Test Batch',
                institution_id: institution.id,
                start_date: tenDaysAgo,
                end_date: tenDaysFromNow,
                status: 'active'
            });
        }
        console.log('Batch:', batch.id);

        // 4. Create Students and Enrollments
        const studentsData = [
            { email: 'perf_A@test.com', firstName: 'Perf', lastName: 'A', score: 95 },
            { email: 'perf_B@test.com', firstName: 'Perf', lastName: 'B', score: 75 },
            { email: 'perf_C@test.com', firstName: 'Perf', lastName: 'C', score: 45 }
        ];

        let quiz = await Quiz.findOne({ where: { name: 'Performance Test Quiz' } });
        if (!quiz) {
            quiz = await Quiz.create({
                name: 'Performance Test Quiz',
                total_marks: 100,
                status: 'published',
                is_published: true
            });
        }
        console.log('Quiz:', quiz.id);

        for (const data of studentsData) {
            // Create Student record first
            let studentRec = await Student.findOne({ where: { email: data.email } });
            if (!studentRec) {
                studentRec = await Student.create({
                    first_name: data.firstName,
                    last_name: data.lastName,
                    email: data.email,
                    password: hashedPassword,
                    status: 'active'
                });
            }

            // Create User record with SAME ID
            let userRec = await User.findOne({ where: { email: data.email } });
            if (!userRec) {
                // Try to create User with the same ID as Student record
                // Note: This might fail if the ID is already taken in the users table
                try {
                    userRec = await User.create({
                        id: studentRec.id,
                        username: (data.firstName + data.lastName).toLowerCase() + '_' + studentRec.id,
                        email: data.email,
                        full_name: data.firstName + ' ' + data.lastName,
                        role: 'student',
                        password_hash: hashedPassword,
                        institution_id: institution.id,
                        is_active: true,
                        is_first_login: false
                    });
                } catch (e) {
                    console.log(`Could not create User with ID ${studentRec.id}, creating with auto-id`);
                    userRec = await User.create({
                        username: (data.firstName + data.lastName).toLowerCase() + '_' + Date.now(),
                        email: data.email,
                        full_name: data.firstName + ' ' + data.lastName,
                        role: 'student',
                        password_hash: hashedPassword,
                        institution_id: institution.id,
                        is_active: true,
                        is_first_login: false
                    });
                    // IMPORTANT: If IDs don't match, the Performance API might fail to find the name 
                    // unless student_id in Enrollment is actually the Student record ID.
                }
            }

            // Enroll the Student (using Student record ID)
            let enrollment = await Enrollment.findOne({ where: { student_id: studentRec.id, batch_id: batch.id } });
            if (!enrollment) {
                enrollment = await Enrollment.create({
                    student_id: studentRec.id,
                    batch_id: batch.id,
                    status: 'active',
                    enrollment_date: tenDaysAgo
                });
            }

            // Create Quiz Submission (using User record ID for student_id and Enrollment ID for enrollment_id)
            let submission = await QuizSubmission.findOne({ 
                where: { enrollment_id: enrollment.id, quiz_id: quiz.id } 
            });
            if (!submission) {
                await QuizSubmission.create({
                    student_id: userRec.id,
                    quiz_id: quiz.id,
                    enrollment_id: enrollment.id,
                    score: data.score,
                    status: 'completed',
                    submitted_at: new Date()
                });
            } else {
                await submission.update({ score: data.score, student_id: userRec.id });
            }
            console.log(`Student ${data.firstName} ${data.lastName} processed.`);
        }

        console.log('Seeding completed successfully.');
        console.log('\n--- Test Credentials ---');
        console.log('Rep Email: rep_perf@test.com');
        console.log('Password: password123');
        console.log('------------------------');

    } catch (error) {
        console.error('Seeding failed:', error);
    } finally {
        await sequelize.close();
    }
}

seed();
