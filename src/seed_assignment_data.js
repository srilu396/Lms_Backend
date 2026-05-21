require('dotenv').config();
const models = require('./models/index');
const bcrypt = require('bcryptjs');

async function seedAssignmentData() {
    try {

        const tutorEmail = 'manideeptutor@gmail.com';
        const tutorPassword = 'P@55word';
        const hashedPassword = await bcrypt.hash(tutorPassword, 10);

        // 1. Create/Find User (Tutor)
        const [user] = await models.User.findOrCreate({
            where: { email: tutorEmail },
            defaults: {
                username: 'manideep_tutor',
                full_name: 'Manideep Tutor',
                role: 'tutor',
                password_hash: hashedPassword,
                is_active: true
            }
        });

        // 2. Create/Find Tutor Profile
        const [tutor] = await models.Tutor.findOrCreate({
            where: { email: tutorEmail },
            defaults: {
                full_name: 'Manideep Tutor',
                password: tutorPassword,
                status: 'active'
            }
        });

        // 3. Create Course
        const [course] = await models.Course.findOrCreate({
            where: { name: 'Full Stack Web Development' },
            defaults: {
                description: 'Complete MERN stack course',
                status: 'active'
            }
        });

        // 4. Create Modules and Topics
        const [module1] = await models.Module.findOrCreate({
            where: { name: 'Frontend Basics', course_id: course.id },
            defaults: { order_num: 1 }
        });

        const [topic1] = await models.Topic.findOrCreate({
            where: { name: 'React Advanced', module_id: module1.id },
            defaults: { order_num: 2 }
        });

        // 5. Create Assignments
        const [assignment1] = await models.Assignment.findOrCreate({
            where: { title: 'React Todo App', course_id: course.id },
            defaults: {
                description: 'Build a Todo application using React and Hooks',
                instructions: '1. Use functional components\n2. Implement CRUD\n3. Style with CSS Modules',
                submission_type: 'link',
                max_score: 100,
                status: 'active',
                module_id: module1.id,
                topic_id: topic1.id
            }
        });

        const [assignment2] = await models.Assignment.findOrCreate({
            where: { title: 'Personal Portfolio', course_id: course.id },
            defaults: {
                description: 'Build a responsive personal portfolio website',
                instructions: '1. Use HTML/CSS\n2. Make it mobile responsive\n3. Include a contact form',
                submission_type: 'file',
                max_score: 100,
                status: 'active',
                module_id: module1.id,
                topic_id: topic1.id
            }
        });

        // 6. Create Batches and assign Tutor
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

            // 7. Link Assignments to Batch (BatchAssignment)
            await models.BatchAssignment.findOrCreate({
                where: { batch_id: batch.id, assignment_id: assignment1.id },
                defaults: {
                    due_date: '2026-05-30',
                    status: 'active'
                }
            });

            await models.BatchAssignment.findOrCreate({
                where: { batch_id: batch.id, assignment_id: assignment2.id },
                defaults: {
                    due_date: '2026-05-15', // Past date for "late" testing
                    status: 'active'
                }
            });


            // 8. Create Students, Enrollments, and Submissions
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

                // 9. Create Mock Submissions for Assignment 1 (React Todo App)
                // Student 1: Submitted (Graded)
                // Student 2: Submitted (Pending Review)
                // Student 3: Pending
                if (i === 1) {
                    await models.AssignmentSubmission.findOrCreate({
                        where: { student_id: sUser.id, assignment_id: assignment1.id, enrollment_id: enrollment.id },
                        defaults: {
                            file_url: 'https://github.com/student1/todo-app',
                            grade: 85,
                            feedback: 'Great work on the React hooks!',
                            status: 'graded',
                            submitted_at: new Date('2026-05-20'),
                            graded_at: new Date('2026-05-21')
                        }
                    });
                } else if (i === 2) {
                    await models.AssignmentSubmission.findOrCreate({
                        where: { student_id: sUser.id, assignment_id: assignment1.id, enrollment_id: enrollment.id },
                        defaults: {
                            file_url: 'https://github.com/student2/todo-app',
                            status: 'submitted',
                            submitted_at: new Date('2026-05-25')
                        }
                    });
                } else {
                    // Student 3: No submission record or status 'pending'
                    await models.AssignmentSubmission.findOrCreate({
                        where: { student_id: sUser.id, assignment_id: assignment1.id, enrollment_id: enrollment.id },
                        defaults: {
                            status: 'pending'
                        }
                    });
                }

                // 10. Create Mock Submissions for Assignment 2 (Portfolio - LATE TESTING)
                // Student 1: Submitted Late
                if (i === 1) {
                    await models.AssignmentSubmission.findOrCreate({
                        where: { student_id: sUser.id, assignment_id: assignment2.id, enrollment_id: enrollment.id },
                        defaults: {
                            file_url: 'https://portfolio-link.com',
                            status: 'submitted',
                            submitted_at: new Date('2026-05-20') // After due date May 15
                        }
                    });
                }
            }
        }


    } catch (error) {
    } finally {
        await models.sequelize.close();
    }
}

seedAssignmentData();
