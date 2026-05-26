const { connectDB, sequelize } = require('../src/db/connect');
const { 
    Batch, 
    Course, 
    User, 
    Enrollment, 
    Student, 
    AttendanceSession, 
    BatchAssignment, 
    StudentAttendance, 
    QuizSubmission, 
    AssignmentSubmission 
} = require('../src/models');
const { Op } = require('sequelize');

async function testExport(batchId) {
    // Original implementation logic in service but without PDF generation so we can measure execution time of the data fetching phase:
    console.time("Original Data Fetch");
    const totalWorkingDays = await AttendanceSession.count({ where: { batch_id: batchId } });
    const totalAssignments = await BatchAssignment.count({ where: { batch_id: batchId } });

    const enrollments = await Enrollment.findAll({
        where: { batch_id: batchId },
        include: [{ 
            model: Student, 
            as: 'student',
            attributes: ['id', 'first_name', 'last_name', 'email', 'status', 'created_at'] 
        }]
    });

    const studentsDataOrig = await Promise.all(enrollments.map(async (enrollment) => {
        const student = enrollment.student;

        let attendancePercent = 0;
        if (totalWorkingDays > 0) {
            const presentDays = await StudentAttendance.count({
                where: { enrollment_id: enrollment.id, status: 'present' }
            });
            attendancePercent = Math.round((presentDays / totalWorkingDays) * 100);
        }

        const quizAvgResult = await QuizSubmission.findOne({
            where: { enrollment_id: enrollment.id },
            attributes: [[sequelize.fn('AVG', sequelize.col('score')), 'avgScore']],
            raw: true
        });
        const quizAvg = parseFloat(parseFloat(quizAvgResult.avgScore || 0).toFixed(1));

        const assignmentsCompleted = await AssignmentSubmission.count({
            where: { enrollment_id: enrollment.id, status: { [Op.in]: ['submitted', 'graded'] } }
        });

        let calculatedStatus = 'On Track';
        if (quizAvg >= 81) {
            calculatedStatus = 'Excellent';
        } else if (attendancePercent < 75 || quizAvg < 40) {
            calculatedStatus = 'At Risk';
        }

        return {
            name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
            attendance: `${attendancePercent}%`,
            quizAvg: `${quizAvg}%`,
            assignments: `${assignmentsCompleted}/${totalAssignments}`,
            status: calculatedStatus,
            rawQuizAvg: quizAvg,
            rawAssignmentsCompleted: assignmentsCompleted,
            rawStatus: calculatedStatus
        };
    }));
    console.timeEnd("Original Data Fetch");

    // Optimized implementation logic:
    console.time("Optimized Data Fetch");
    const [totalWorkingDaysOpt, totalAssignmentsOpt] = await Promise.all([
        AttendanceSession.count({ where: { batch_id: batchId } }),
        BatchAssignment.count({ where: { batch_id: batchId } })
    ]);

    const enrollmentsOpt = await Enrollment.findAll({
        where: { batch_id: batchId },
        include: [{ 
            model: Student, 
            as: 'student',
            attributes: ['id', 'first_name', 'last_name', 'email', 'status', 'created_at'] 
        }]
    });

    const enrollmentIds = enrollmentsOpt.map(e => e.id);

    let presentDaysMap = {};
    let quizAvgMap = {};
    let assignmentsCompletedMap = {};

    if (enrollmentIds.length > 0) {
        const [presentDaysCounts, quizAvgResults, assignmentsCompletedCounts] = await Promise.all([
            StudentAttendance.findAll({
                attributes: ['enrollment_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                where: { enrollment_id: { [Op.in]: enrollmentIds }, status: 'present' },
                group: ['enrollment_id'],
                raw: true
            }),
            QuizSubmission.findAll({
                attributes: ['enrollment_id', [sequelize.fn('AVG', sequelize.col('score')), 'avgScore']],
                where: { enrollment_id: { [Op.in]: enrollmentIds } },
                group: ['enrollment_id'],
                raw: true
            }),
            AssignmentSubmission.findAll({
                attributes: ['enrollment_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                where: { enrollment_id: { [Op.in]: enrollmentIds }, status: { [Op.in]: ['submitted', 'graded'] } },
                group: ['enrollment_id'],
                raw: true
            })
        ]);

        presentDaysCounts.forEach(c => {
            presentDaysMap[c.enrollment_id] = parseInt(c.count) || 0;
        });

        quizAvgResults.forEach(c => {
            quizAvgMap[c.enrollment_id] = parseFloat(c.avgScore) || 0;
        });

        assignmentsCompletedCounts.forEach(c => {
            assignmentsCompletedMap[c.enrollment_id] = parseInt(c.count) || 0;
        });
    }

    const studentsDataOpt = enrollmentsOpt.map(enrollment => {
        const student = enrollment.student;

        const enrollmentId = enrollment.id;
        const presentCount = presentDaysMap[enrollmentId] || 0;
        const quizAvgVal = quizAvgMap[enrollmentId] || 0;
        const assignmentsCompleted = assignmentsCompletedMap[enrollmentId] || 0;

        let attendancePercent = 0;
        if (totalWorkingDaysOpt > 0) {
            attendancePercent = Math.round((presentCount / totalWorkingDaysOpt) * 100);
        }

        const quizAvg = parseFloat(quizAvgVal.toFixed(1));

        let calculatedStatus = 'On Track';
        if (quizAvg >= 81) {
            calculatedStatus = 'Excellent';
        } else if (attendancePercent < 75 || quizAvg < 40) {
            calculatedStatus = 'At Risk';
        }

        return {
            name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
            attendance: `${attendancePercent}%`,
            quizAvg: `${quizAvg}%`,
            assignments: `${assignmentsCompleted}/${totalAssignmentsOpt}`,
            status: calculatedStatus,
            rawQuizAvg: quizAvg,
            rawAssignmentsCompleted: assignmentsCompleted,
            rawStatus: calculatedStatus
        };
    });
    console.timeEnd("Optimized Data Fetch");

    console.log("Check data equality:", JSON.stringify(studentsDataOrig) === JSON.stringify(studentsDataOpt));
}

async function verify() {
    await connectDB();
    console.log("Connected to DB.");

    await testExport(8); // Test with Batch ID 8
    process.exit(0);
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
