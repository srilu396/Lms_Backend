const { 
    User,
    Batch, 
    Course, 
    Enrollment, 
    Assignment, 
    Quiz, 
    Module, 
    Topic, 
    Lesson, 
    LessonProgress,
    AssignmentSubmission,
    QuizSubmission,
    Student,
    sequelize 
} = require('./src/models');

async function seedProgressData() {
    try {
        console.log("Seeding progress data for existing batches...");
        const user = await User.findOne({ where: { email: 'kietwomens@gmail.com' } });
        if (!user) {
            console.log("User not found!");
            return;
        }
        
        const institutionId = user.institution_id || user.id; 
        
        const batches = await Batch.findAll({ where: { institution_id: institutionId } });
        
        for (const batch of batches) {
            console.log(`Processing batch: ${batch.name} (Course ID: ${batch.course_id})`);
            const courseId = batch.course_id;
            
            // 1. Ensure Modules, Topics, Lessons exist
            let mod = await Module.findOne({ where: { course_id: courseId } });
            if (!mod) {
                mod = await Module.create({ course_id: courseId, name: 'Dummy Module', description: 'Dummy' });
            }
            
            let topic = await Topic.findOne({ where: { module_id: mod.id } });
            if (!topic) {
                topic = await Topic.create({ module_id: mod.id, name: 'Dummy Topic', description: 'Dummy' });
            }
            
            let lessons = await Lesson.findAll({ where: { topic_id: topic.id } });
            if (lessons.length === 0) {
                for (let i = 0; i < 5; i++) {
                    const l = await Lesson.create({ topic_id: topic.id, title: `Lesson ${i+1}`, content: 'Dummy', order_num: i+1 });
                    lessons.push(l);
                }
            }

            // 2. Ensure Assignments exist
            let assignment = await Assignment.findOne({ where: { course_id: courseId } });
            if (!assignment) {
                assignment = await Assignment.create({ course_id: courseId, title: 'Final Project', max_score: 100, submission_type: 'link' });
            }
            
            // 3. Ensure Quizzes exist
            let quiz = await Quiz.findOne({ where: { topic_id: topic.id } });
            if (!quiz) {
                quiz = await Quiz.create({ topic_id: topic.id, name: 'Topic Quiz', total_marks: 100, status: 'published' });
            }

            const enrollments = await Enrollment.findAll({ where: { batch_id: batch.id } });
            
            for (const enrollment of enrollments) {
                const studentRec = await Student.findByPk(enrollment.student_id);
                if (!studentRec) continue;
                
                const userRec = await User.findOne({ where: { email: studentRec.email } });
                if (!userRec) continue; // If User doesn't exist, we skip to avoid foreign key errors

                const userId = userRec.id; // Correct student_id for progress models

                const lessonsToComplete = Math.floor(Math.random() * lessons.length) + 1;
                for (let i = 0; i < lessonsToComplete; i++) {
                    await LessonProgress.findOrCreate({
                        where: { student_id: userId, enrollment_id: enrollment.id, lesson_id: lessons[i].id },
                        defaults: { is_completed: true, completed_at: new Date() }
                    });
                }
                
                if (Math.random() > 0.3) {
                    await AssignmentSubmission.findOrCreate({
                        where: { student_id: userId, enrollment_id: enrollment.id, assignment_id: assignment.id },
                        defaults: { status: 'graded', obtained_score: Math.floor(Math.random() * 100), submitted_at: new Date() }
                    });
                }
                
                if (Math.random() > 0.2) {
                    await QuizSubmission.findOrCreate({
                        where: { student_id: userId, enrollment_id: enrollment.id, quiz_id: quiz.id },
                        defaults: { status: 'completed', score: Math.floor(Math.random() * 100), submitted_at: new Date() }
                    });
                }
            }
        }
        
        console.log("Progress data seeded successfully.");
    } catch(err) {
        console.error("Error seeding progress:", err);
    } finally {
        await sequelize.close();
    }
}

seedProgressData();
