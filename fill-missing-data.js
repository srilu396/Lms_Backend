const { 
    User,
    Batch, 
    Enrollment, 
    QuizSubmission, 
    Quiz, 
    AttendanceSession, 
    StudentAttendance,
    sequelize 
} = require('./src/models');
const { Op } = require('sequelize');

async function fillMissingData() {
    try {
        console.log("Filling missing scores and attendance for existing students...");
        const user = await User.findOne({ where: { email: 'kietwomens@gmail.com' } });
        if (!user) return;
        const institutionId = user.institution_id || user.id;

        const batches = await Batch.findAll({ where: { institution_id: institutionId } });
        if (batches.length === 0) return;

        const batchIds = batches.map(b => b.id);

        const enrollments = await Enrollment.findAll({
            where: { batch_id: { [Op.in]: batchIds } }
        });

        for (let e of enrollments) {
            // Check if they have quiz submissions
            const subCount = await QuizSubmission.count({ where: { enrollment_id: e.id } });
            
            // For QuizSubmissions, we need a User ID. Let's find or create a User for this student.
            // Since we only have student_id (which is Student model), let's get the Student.
            const { Student } = require('./src/models');
            const student = await Student.findByPk(e.student_id);
            if (!student) continue;

            const user = await User.findOrCreate({
                where: { email: student.email },
                defaults: { full_name: `${student.first_name} ${student.last_name}`, username: student.email.split('@')[0], password_hash: 'pass', role: 'student', institution_id: institutionId }
            });
            const uId = user[0].id;

            if (subCount === 0) {
                const quiz = await Quiz.findOne();
                if (quiz) {
                    const maxMarks = quiz.total_marks || 100;
                    const percentage = Math.floor(Math.random() * 50) + 30; // Random percentage between 30 and 80
                    const score = (percentage / 100) * maxMarks;
                    await QuizSubmission.create({
                        enrollment_id: e.id,
                        quiz_id: quiz.id,
                        student_id: uId,
                        score: score,
                        submitted_at: new Date()
                    });
                }
            }

            // Fill attendance
            const attCount = await StudentAttendance.count({ where: { enrollment_id: e.id } });
            if (attCount === 0) {
                const sessions = await AttendanceSession.findAll({ where: { batch_id: e.batch_id } });
                for (let j = 0; j < sessions.length; j++) {
                    const status = Math.random() > 0.4 ? 'present' : 'absent';
                    await StudentAttendance.create({
                        enrollment_id: e.id,
                        session_id: sessions[j].id,
                        student_id: uId,
                        status: status
                    });
                }
            }
        }
        console.log("Done");
    } catch(err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
}
fillMissingData();
