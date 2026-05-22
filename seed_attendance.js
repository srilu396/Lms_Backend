const { sequelize, Batch, Enrollment, User, AttendanceSession, StudentAttendance, Student } = require('./src/models');

async function seedAttendance() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB');

        const instRep = await User.findOne({ where: { email: 'kietwomens@gmail.com' } });
        const institutionId = instRep.institution_id;

        const batches = await Batch.findAll({ where: { institution_id: institutionId } });
        if (batches.length === 0) return;
        
        const batch = batches[0];
        console.log(`Using Batch ID: ${batch.id}, Name: ${batch.name}`);

        const validUsers = await User.findAll({ where: { role: 'student', institution_id: institutionId }, limit: 5 });
        
        const enrollments = [];
        
        for (const u of validUsers) {
            let stu = await Student.findByPk(u.id);
            if (!stu) {
                try {
                    await Student.create({
                        id: u.id,
                        first_name: u.full_name ? u.full_name.split(' ')[0] : 'First',
                        last_name: u.full_name ? u.full_name.split(' ').slice(1).join(' ') : 'Last',
                        email: 'st_' + u.id + '_' + u.email,
                        password: u.password_hash || 'dummy',
                        status: 'active'
                    });
                } catch (err) {
                    console.log('Error creating student using model:', err.message);
                }
            }

            let enr = await Enrollment.findOne({ where: { student_id: u.id, batch_id: batch.id } });
            if (!enr) {
                enr = await Enrollment.create({
                    student_id: u.id,
                    batch_id: batch.id,
                    status: 'active'
                });
            }
            enrollments.push(enr);
        }

        console.log(`Found ${enrollments.length} valid enrollments.`);
        if (enrollments.length === 0) return;

        const startYear = 2025;
        const startMonth = 11; // December
        const endYear = 2026;
        const endMonth = 4; // May
        
        let currentDate = new Date(startYear, startMonth, 1);
        const endDate = new Date(endYear, endMonth, 31);
        
        let sessionCount = 0;
        let attendanceCount = 0;

        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                if (Math.random() > 0.05) { 
                    const sessionDateStr = currentDate.toISOString().split('T')[0];
                    
                    let session = await AttendanceSession.findOne({
                        where: {
                            batch_id: batch.id,
                            session_date: sessionDateStr
                        }
                    });

                    if (!session) {
                        session = await AttendanceSession.create({
                            batch_id: batch.id,
                            session_date: sessionDateStr,
                            session_name: `Class - ${sessionDateStr}`,
                            start_time: '09:00:00',
                            end_time: '11:00:00'
                        });
                        sessionCount++;
                    }

                    for (const enrollment of enrollments) {
                        let attendance = await StudentAttendance.findOne({
                            where: {
                                student_id: enrollment.student_id,
                                session_id: session.id
                            }
                        });

                        if (!attendance) {
                            const rand = Math.random();
                            let status = 'present';
                            if (rand < 0.1) status = 'absent';
                            else if (rand < 0.15) status = 'late';
                            
                            await StudentAttendance.create({
                                student_id: enrollment.student_id,
                                session_id: session.id,
                                enrollment_id: enrollment.id,
                                status: status
                            });
                            attendanceCount++;
                        }
                    }
                }
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        console.log(`Created ${sessionCount} new sessions.`);
        console.log(`Created ${attendanceCount} new attendance records.`);
        console.log(`\nTest API:`);
        console.log(`GET /api/v1/institution-rep/batches/${batch.id}/students/${enrollments[0].student_id}/attendance-calendar?month=2026-02\n`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

seedAttendance();
