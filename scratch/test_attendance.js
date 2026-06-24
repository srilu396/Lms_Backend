const { StudentAttendance, Student, User, AttendanceSession, Batch, Course } = require('../src/models');

async function test() {
    try {
        // Just find some student attendance records to see what we have
        const allAtt = await StudentAttendance.findAll({ limit: 5 });
        console.log("Some attendance records:", allAtt.map(a => a.toJSON()));

        if (allAtt.length > 0) {
            const studentId = allAtt[0].student_id;
            console.log("\nTesting query for student_id:", studentId);
            
            const attendanceRecords = await StudentAttendance.findAll({
                where: { student_id: studentId },
                include: [
                    {
                        model: AttendanceSession,
                        required: true,
                        include: [
                            {
                                model: Batch,
                                required: true,
                                include: [
                                    { model: Course, attributes: ['name'] }
                                ],
                                attributes: ['name']
                            }
                        ]
                    }
                ],
                order: [[AttendanceSession, 'session_date', 'DESC']]
            });
            console.log("\nQuery result length:", attendanceRecords.length);
            if (attendanceRecords.length > 0) {
                console.log("First record:", JSON.stringify(attendanceRecords[0].toJSON(), null, 2));
            }
        } else {
            console.log("No attendance records in DB at all.");
        }
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit();
}

test();
