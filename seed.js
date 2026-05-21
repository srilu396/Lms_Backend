const { 
    User,
    Institution,
    Batch, 
    Enrollment, 
    QuizSubmission, 
    Quiz, 
    Course,
    Assignment,
    AssignmentSubmission, 
    BatchAssignment, 
    AttendanceSession, 
    StudentAttendance,
    Student,
    sequelize 
} = require('./src/models');
const { Op } = require('sequelize');

async function seedData() {
    try {
        console.log("Starting data seeding...");
        // Get user
        const user = await User.findOne({ where: { email: 'kietwomens@gmail.com' } });
        if (!user) {
            console.log("User not found!");
            return;
        }
        
        console.log("User:", user.toJSON());
        const institutionId = user.institution_id || user.id; 
        console.log("Institution ID:", institutionId);

        // Fetch batches for this institution
        let batches = await Batch.findAll({ where: { institution_id: institutionId } });
        
        // Ensure 3 batches exist
        if (batches.length < 3) {
            console.log("Less than 3 batches. Creating batches...");
            for(let i = batches.length; i < 3; i++) {
                const b = await Batch.create({
                    institution_id: institutionId,
                    name: `CS-2024-B${i + 1}`,
                    status: i === 2 ? 'completed' : 'active',
                    start_date: new Date(),
                    end_date: new Date(new Date().setMonth(new Date().getMonth() + 6))
                });
                batches.push(b);
            }
        }
        
        console.log("Batches:", batches.map(b => b.name));
        
        const course = await Course.findOrCreate({
            where: { name: 'Introduction to Computer Science' },
            defaults: { description: 'Intro course', institution_id: institutionId }
        });
        
        const c = course[0];
        
        // We will seed students, enrollments, etc for the 3 batches
        for (let i = 0; i < 3; i++) {
            const batch = batches[i];
            console.log(`Processing batch ${batch.name}`);
            
            // Batch Assignment
            const assignment = await Assignment.findOrCreate({
                where: { title: `Assignment for ${batch.name}` },
                defaults: { course_id: c.id, max_score: 100, submission_type: 'link' }
            });
            
            const batchAssignment = await BatchAssignment.findOrCreate({
                where: { batch_id: batch.id, assignment_id: assignment[0].id },
                defaults: { due_date: new Date() }
            });
            
            // Quiz
            const quiz = await Quiz.findOrCreate({
                where: { name: `Quiz for ${batch.name}` },
                defaults: { course_id: c.id, total_marks: 100, status: 'published' }
            });
            
            // Create some attendance sessions
            let sessions = await AttendanceSession.findAll({ where: { batch_id: batch.id } });
            if (sessions.length < 20) {
                for (let j = sessions.length; j < 20; j++) {
                    const session = await AttendanceSession.create({
                        batch_id: batch.id,
                        session_date: new Date(new Date().setDate(new Date().getDate() - j))
                    });
                    sessions.push(session);
                }
            }
            
            // Students
            for (let k = 1; k <= 5; k++) {
                const user = await User.findOrCreate({
                    where: { email: `student${i}_${k}@example.com` },
                    defaults: { full_name: `Student${i} Test${k}`, username: `student${i}_${k}`, password_hash: 'password123', role: 'student', institution_id: institutionId }
                });
                const u = user[0];

                const student = await Student.findOrCreate({
                    where: { email: `student${i}_${k}@example.com` },
                    defaults: { first_name: `Student${i}`, last_name: `Test${k}`, password: 'password123', course_id: c.id }
                });
                
                const s = student[0];
                
                const enrollment = await Enrollment.findOrCreate({
                    where: { batch_id: batch.id, student_id: s.id },
                    defaults: { status: 'active' }
                });
                
                const e = enrollment[0];
                
                let score = 85;
                let attendanceRate = 0.9;
                
                if (k === 1) { // Critical
                    score = 40;
                    attendanceRate = 0.5;
                } else if (k === 2) { // Warning
                    score = 65;
                    attendanceRate = 0.7;
                }
                
                // Quiz Submissions
                const recentDate = new Date(); // Current month for trend
                await QuizSubmission.findOrCreate({
                    where: { enrollment_id: e.id, quiz_id: quiz[0].id },
                    defaults: { score: score, submitted_at: recentDate, student_id: u.id }
                });
                
                // Past Quiz (for trend calculation)
                const lastMonthDate = new Date();
                lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
                
                const pastQuiz = await Quiz.findOrCreate({
                    where: { name: `Past Quiz for ${batch.name}` },
                    defaults: { course_id: c.id, total_marks: 100, status: 'published' }
                });
                await QuizSubmission.findOrCreate({
                    where: { enrollment_id: e.id, quiz_id: pastQuiz[0].id },
                    defaults: { score: score - 5, submitted_at: lastMonthDate, student_id: u.id }
                });
                
                // Assignment Submissions (for completion rate)
                await AssignmentSubmission.findOrCreate({
                    where: { enrollment_id: e.id, assignment_id: assignment[0].id },
                    defaults: { status: k % 2 === 0 ? 'submitted' : 'pending', student_id: u.id }
                });
                
                // Attendance
                for (let j = 0; j < sessions.length; j++) {
                    const status = (j < sessions.length * attendanceRate) ? 'present' : 'absent';
                    await StudentAttendance.findOrCreate({
                        where: { enrollment_id: e.id, session_id: sessions[j].id },
                        defaults: { status: status, student_id: u.id }
                    });
                }
            }
        }
        
        console.log("Seeding complete.");
    } catch(err) {
        console.error("Error during seeding:", err);
    } finally {
        await sequelize.close();
    }
}

seedData();
