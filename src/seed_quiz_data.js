require('dotenv').config();
const models = require('./models/index');
const bcrypt = require('bcryptjs');

async function seedQuizData() {
    try {
        console.log("--- STARTING QUIZ DATA SEEDING ---\n");

        const tutorEmail = 'manideeptutor@gmail.com';
        const tutorPassword = 'P@55word';
        const hashedPassword = await bcrypt.hash(tutorPassword, 10);

        // 1. Create/Find User
        const [user, userCreated] = await models.User.findOrCreate({
            where: { email: tutorEmail },
            defaults: {
                username: 'manideep_tutor',
                full_name: 'Manideep Tutor',
                role: 'tutor',
                password_hash: hashedPassword,
                is_active: true
            }
        });
        console.log(`${userCreated ? '✅ Created' : 'ℹ️ Found'} User: ${user.email}`);

        // 2. Create/Find Tutor Profile
        const [tutor, tutorCreated] = await models.Tutor.findOrCreate({
            where: { email: tutorEmail },
            defaults: {
                full_name: 'Manideep Tutor',
                password: tutorPassword, // Note: model has a hook for bcrypt
                status: 'active'
            }
        });
        console.log(`${tutorCreated ? '✅ Created' : 'ℹ️ Found'} Tutor Profile: ${tutor.email}`);

        // 3. Create Course
        const [course] = await models.Course.findOrCreate({
            where: { name: 'Full Stack Web Development' },
            defaults: {
                description: 'Complete MERN stack course',
                status: 'active'
            }
        });
        console.log(`✅ Course ensured: ${course.name}`);

        // 4. Create Modules, Topics, and Quizzes
        const [module1] = await models.Module.findOrCreate({
            where: { name: 'Frontend Basics', course_id: course.id },
            defaults: { order_num: 1 }
        });

        const [topic1] = await models.Topic.findOrCreate({
            where: { name: 'HTML & CSS Basics', module_id: module1.id },
            defaults: { order_num: 1 }
        });

        const [quiz1] = await models.Quiz.findOrCreate({
            where: { name: 'Web Foundation Quiz', topic_id: topic1.id },
            defaults: {
                course_id: course.id,
                module_id: module1.id,
                total_marks: 50,
                status: 'published',
                is_published: true
            }
        });
        console.log(`✅ Quizzes ensured for course`);

        // 5. Create Batches and assign Tutor
        const batchNames = ['Sept-Morning-Batch', 'Oct-Evening-Batch'];
        for (const bName of batchNames) {
            const [batch] = await models.Batch.findOrCreate({
                where: { name: bName },
                defaults: {
                    course_id: course.id,
                    status: 'active',
                    start_date: '2026-03-01'
                }
            });

            await models.BatchTutor.findOrCreate({
                where: { batch_id: batch.id, tutor_id: tutor.id },
                defaults: { is_primary: true }
            });
            console.log(`✅ Batch ensured and assigned: ${batch.name}`);

            // 6. Create Students and Enrollments
            for (let i = 1; i <= 3; i++) {
                const sEmail = `student${i}.${bName.toLowerCase()}@example.com`;
                const [sUser] = await models.User.findOrCreate({
                    where: { email: sEmail },
                    defaults: {
                        username: `student_${i}_${batch.id}`,
                        full_name: `Student ${i} of ${bName}`,
                        role: 'student',
                        password_hash: hashedPassword,
                        is_active: true
                    }
                });

                const [student] = await models.Student.findOrCreate({
                    where: { email: sEmail },
                    defaults: {
                        first_name: 'Student',
                        last_name: `${i} of ${batch.id}`,
                        password: tutorPassword,
                        status: 'active'
                    }
                });

                const [enrollment] = await models.Enrollment.findOrCreate({
                    where: { student_id: student.id, batch_id: batch.id }
                });

                // 7. Create Mock Submissions
                // Student 1: reviewed (80%), Student 2: pending_review (N/A), Student 3: completed (90%)
                const submissionStatuses = ['reviewed', 'pending_review', 'completed'];
                const scores = [40, null, 45];
                
                await models.QuizSubmission.findOrCreate({
                    where: { 
                        student_id: sUser.id, 
                        quiz_id: quiz1.id, 
                        enrollment_id: enrollment.id,
                        attempt_number: 1
                    },
                    defaults: {
                        score: scores[i-1],
                        status: submissionStatuses[i-1],
                        submitted_at: new Date()
                    }
                });
            }
            console.log(`   - Enrolled 3 students and created submissions for ${bName}`);
        }

        console.log("\n✅ SEEDING COMPLETED SUCCESSFULLY!");

    } catch (error) {
        console.error("\n❌ Error during seeding:");
        console.error(error);
    } finally {
        await models.sequelize.close();
    }
}

seedQuizData();
