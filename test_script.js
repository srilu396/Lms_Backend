const { 
    User,
    Institution,
    Batch, 
    Student, 
    Enrollment, 
    QuizSubmission, 
    AssignmentSubmission, 
    Assignment,
    BatchAssignment,
    AttendanceSession,
    StudentAttendance,
    Quiz,
    Course,
    Module,
    Topic
} = require('./src/models');
const axios = require('axios');

async function run() {
    try {
        // 1. Get institution rep
        const user = await User.findOne({ where: { email: 'kietwomens@gmail.com' } });
        if (!user) {
            console.log("User not found");
            return;
        }
        
        console.log("Institution Rep found:", user.id);
        const institutionId = user.institution_id;

        // Login to get token
        const loginRes = await axios.post('http://localhost:5000/auth/login', {
            email: 'kietwomens@gmail.com',
            password: 'P@55word'
        });
        console.log('Login Response:', loginRes.data);
        const token = loginRes.data.accessToken || loginRes.data.access_token || loginRes.data.token;
        console.log("Logged in successfully. Token obtained.");

        // 2. Find a batch for this institution
        const batch = await Batch.findOne({ where: { institution_id: institutionId } });
        if (!batch) {
            console.log("No batch found");
            return;
        }
        console.log("Batch found:", batch.id, batch.name);

        // 3. Find an enrollment in this batch
        const enrollment = await Enrollment.findOne({ 
            where: { batch_id: batch.id },
            include: [{ model: Student, as: 'student' }]
        });
        
        if (!enrollment) {
            console.log("No enrollment found in this batch. Creating one...");
            const student = await Student.create({
                first_name: 'Alex',
                last_name: 'Thompson',
                email: 'alex.t@university.edu',
                status: 'active'
            });
            await Enrollment.create({
                batch_id: batch.id,
                student_id: student.id,
                status: 'active'
            });
            console.log("Enrollment created.");
            return run(); // retry
        }

        const student = enrollment.student;
        console.log("Student found:", student.id, student.first_name);

        // 4. Seed Attendance Data
        const totalWorkingDays = 30;
        const presentDays = 26;
        
        const existingSessions = await AttendanceSession.count({ where: { batch_id: batch.id } });
        if (existingSessions < totalWorkingDays) {
            for (let i = existingSessions; i < totalWorkingDays; i++) {
                const session = await AttendanceSession.create({
                    batch_id: batch.id,
                    session_date: new Date(Date.now() - i * 86400000),
                    status: 'completed'
                });
                
                if (i < presentDays) {
                    await StudentAttendance.create({
                        session_id: session.id,
                        student_id: user.id, // bypass FK to users table
                        enrollment_id: enrollment.id,
                        status: 'present',
                        date: session.session_date
                    });
                }
            }
            console.log("Attendance seeded.");
        }

        // 5. Seed Course, Module, Topic, Assignment, Quiz if not exist
        const course = await Course.findOne() || await Course.create({ title: 'Fullstack Dev', description: 'desc', status: 'published' });
        batch.course_id = course.id;
        await batch.save();

        const module = await Module.findOne({ where: { course_id: course.id } }) || await Module.create({ course_id: course.id, title: 'Database Optimization', description: 'desc', order: 1 });
        const topic = await Topic.findOne({ where: { module_id: module.id } }) || await Topic.create({ module_id: module.id, title: 'SQL Tuning', description: 'desc', order: 1 });

        // Seed Assignment
        let assignment = await Assignment.findOne({ where: { module_id: module.id } });
        if (!assignment) {
            assignment = await Assignment.create({
                course_id: course.id,
                module_id: module.id,
                title: 'React State MGMT Lab',
                description: 'Build a stateful component',
                max_score: 100
            });
            await BatchAssignment.create({
                batch_id: batch.id,
                assignment_id: assignment.id,
                due_date: new Date()
            });
            await AssignmentSubmission.create({
                student_id: user.id,
                enrollment_id: enrollment.id,
                assignment_id: assignment.id,
                status: 'graded',
                grade: 95,
                submitted_at: new Date(Date.now() - 86400000 * 2)
            });
            console.log("Assignment seeded.");
        } else {
             // Ensure submission exists
             const sub = await AssignmentSubmission.findOne({ where: { enrollment_id: enrollment.id, assignment_id: assignment.id } });
             if (!sub) {
                 await AssignmentSubmission.create({
                    student_id: user.id,
                    enrollment_id: enrollment.id,
                    assignment_id: assignment.id,
                    status: 'graded',
                    grade: 95,
                    submitted_at: new Date(Date.now() - 86400000 * 2)
                });
             }
             const ba = await BatchAssignment.findOne({ where: { batch_id: batch.id, assignment_id: assignment.id } });
             if (!ba) {
                 await BatchAssignment.create({
                    batch_id: batch.id,
                    assignment_id: assignment.id,
                    due_date: new Date()
                });
             }
        }

        let assignment2 = await Assignment.findOne({ where: { title: 'API Design Midterm' } });
        if (!assignment2) {
             assignment2 = await Assignment.create({
                course_id: course.id,
                module_id: module.id,
                title: 'API Design Midterm',
                description: 'Design an API',
                max_score: 50
            });
            await BatchAssignment.create({
                batch_id: batch.id,
                assignment_id: assignment2.id,
                due_date: new Date()
            });
            await AssignmentSubmission.create({
                student_id: user.id,
                enrollment_id: enrollment.id,
                assignment_id: assignment2.id,
                status: 'graded',
                grade: 42,
                submitted_at: new Date(Date.now() - 86400000 * 4)
            });
        }


        // Seed Quiz
        let quiz = await Quiz.findOne({ where: { course_id: course.id } });
        if (!quiz) {
            quiz = await Quiz.create({
                course_id: course.id,
                module_id: module.id,
                name: 'SQL Performance Tuning Quiz',
                total_marks: 20,
                is_published: true
            });
            await QuizSubmission.create({
                student_id: user.id,
                enrollment_id: enrollment.id,
                quiz_id: quiz.id,
                score: 18,
                status: 'completed',
                submitted_at: new Date(Date.now() - 86400000)
            });
            console.log("Quiz seeded.");
        } else {
             const sub = await QuizSubmission.findOne({ where: { enrollment_id: enrollment.id, quiz_id: quiz.id } });
             if (!sub) {
                  await QuizSubmission.create({
                    student_id: user.id,
                    enrollment_id: enrollment.id,
                    quiz_id: quiz.id,
                    score: 18,
                    status: 'completed',
                    submitted_at: new Date(Date.now() - 86400000)
                });
             }
        }

        let quiz2 = await Quiz.findOne({ where: { name: 'Backend Architectural Patterns' } });
        if (!quiz2) {
            quiz2 = await Quiz.create({
                course_id: course.id,
                module_id: module.id,
                name: 'Backend Architectural Patterns',
                total_marks: 20,
                is_published: true
            });
            await QuizSubmission.create({
                student_id: user.id,
                enrollment_id: enrollment.id,
                quiz_id: quiz2.id,
                score: 14,
                status: 'completed',
                submitted_at: new Date(Date.now() - 86400000 * 3)
            });
        }


        // Test API 1
        console.log(`\nTesting GET Stats API: /api/v1/institution-rep/batches/${batch.id}/students/${student.id}/stats`);
        const statsRes = await axios.get(`http://localhost:5000/api/v1/institution-rep/batches/${batch.id}/students/${student.id}/stats`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Stats Response:");
        console.log(JSON.stringify(statsRes.data, null, 2));

        // Test API 2 (all)
        console.log(`\nTesting GET Academic Performance API: /api/v1/institution-rep/batches/${batch.id}/students/${student.id}/academic-performance?page=1&limit=10&type=all`);
        const perfRes = await axios.get(`http://localhost:5000/api/v1/institution-rep/batches/${batch.id}/students/${student.id}/academic-performance?page=1&limit=10&type=all`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Academic Performance Response (all):");
        console.log(JSON.stringify(perfRes.data, null, 2));

        // Test API 2 (quiz)
        console.log(`\nTesting GET Academic Performance API: /api/v1/institution-rep/batches/${batch.id}/students/${student.id}/academic-performance?type=quiz`);
        const perfResQuiz = await axios.get(`http://localhost:5000/api/v1/institution-rep/batches/${batch.id}/students/${student.id}/academic-performance?type=quiz`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Academic Performance Response (quiz):");
        console.log(JSON.stringify(perfResQuiz.data.data.submissions, null, 2));

        // Test API 2 (search)
        console.log(`\nTesting GET Academic Performance API: /api/v1/institution-rep/batches/${batch.id}/students/${student.id}/academic-performance?search=React`);
        const perfResSearch = await axios.get(`http://localhost:5000/api/v1/institution-rep/batches/${batch.id}/students/${student.id}/academic-performance?search=React`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Academic Performance Response (search React):");
        console.log(JSON.stringify(perfResSearch.data.data.submissions, null, 2));


    } catch (e) {
        console.error("Error occurred:");
        console.error(e.response ? JSON.stringify(e.response.data, null, 2) : e.message);
        console.error(e.stack);
    }
}

run();
