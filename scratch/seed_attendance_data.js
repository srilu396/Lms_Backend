const models = require('../src/models');
const { User, Batch, Enrollment, AttendanceSession, StudentAttendance, Course } = models;

async function seedAttendance() {
    try {
        // 1. Find user
        const user = await User.findOne({ where: { email: 'anil@gmail.com' } });
        if (!user) {
            console.log('User not found');
            return;
        }
        console.log('User ID:', user.id);

        // 2. Find or create a course
        let course = await Course.findOne();
        if (!course) {
            course = await Course.create({
                name: 'Test Course for Attendance',
                description: 'Dummy course',
                duration_months: 3,
                fee: 1000
            });
            console.log('Created dummy course ID:', course.id);
        }

        // 3. Find or create a batch
        let batch = await Batch.findOne({ where: { course_id: course.id } });
        if (!batch) {
            batch = await Batch.create({
                course_id: course.id,
                name: 'Test Batch for Attendance',
                start_date: new Date(),
                end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            });
            console.log('Created dummy batch ID:', batch.id);
        }

        // 4. Ensure enrollment
        let enrollment = await Enrollment.findOne({
            where: { student_id: user.id, batch_id: batch.id, status: 'active' }
        });
        
        if (!enrollment) {
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

        // 5. Create Attendance Sessions for the past 5 days
        const statuses = ['present', 'present', 'absent', 'late', 'present'];
        const notes = ['On time', 'Good participation', 'Sick leave', 'Traffic', 'On time'];

        for (let i = 0; i < 5; i++) {
            const date = new Date();
            date.setDate(date.getDate() - i); // Past 5 days

            let session = await AttendanceSession.findOne({
                where: { batch_id: batch.id, session_date: date.toISOString().split('T')[0] }
            });

            if (!session) {
                session = await AttendanceSession.create({
                    batch_id: batch.id,
                    session_date: date.toISOString().split('T')[0]
                });
                console.log(`Created session for date ${session.session_date}`);
            } else {
                console.log(`Session already exists for date ${session.session_date}`);
            }

            // 6. Create Student Attendance for this session
            const existingAttendance = await StudentAttendance.findOne({
                where: { student_id: user.id, session_id: session.id }
            });

            if (!existingAttendance) {
                await StudentAttendance.create({
                    student_id: user.id,
                    session_id: session.id,
                    enrollment_id: enrollment.id, // Fixed: Added enrollment_id
                    status: statuses[i],
                    notes: notes[i]
                });
                console.log(`Added attendance: ${statuses[i]} for date ${session.session_date}`);
            } else {
                console.log(`Attendance already exists for date ${session.session_date}`);
            }
        }

        console.log('Attendance seeding completed successfully!');
    } catch (error) {
        console.error('Attendance seeding failed:', error);
    }
}

seedAttendance();
