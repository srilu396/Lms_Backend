const { connectDB } = require('./src/db/connect');
const { AttendanceSession, Enrollment } = require('./src/models');

async function getPayload() {
    await connectDB();
    
    // Find the latest attendance session
    const session = await AttendanceSession.findOne({
        order: [['created_at', 'DESC']]
    });

    if (!session) {
        console.log("No attendance sessions found. Please create one first.");
        process.exit(1);
    }

    console.log(`Found Session ID: ${session.id} for Batch ID: ${session.batch_id}`);

    // Get enrollments for this batch
    const enrollments = await Enrollment.findAll({
        where: { batch_id: session.batch_id }
    });

    if (enrollments.length === 0) {
        console.log(`No enrollments found for Batch ID: ${session.batch_id}.`);
        process.exit(1);
    }

    const attendancePayload = [];
    const statuses = ['present', 'absent', 'late'];

    enrollments.forEach((enrollment, index) => {
        attendancePayload.push({
            student_id: enrollment.student_id,
            enrollment_id: enrollment.id,
            status: statuses[index % statuses.length]
        });
    });

    console.log("\n--- POSTMAN PAYLOAD FOR MARKING ATTENDANCE ---");
    console.log(`URL: POST http://localhost:5000/api/v1/attendance/session/${session.id}/mark\n`);
    console.log(JSON.stringify({ attendance: attendancePayload }, null, 2));

    process.exit(0);
}

getPayload().catch(err => {
    console.error(err);
    process.exit(1);
});
