const PDFDocument = require('pdfkit-table');
const { Batch, Course, User, Enrollment, Student, AttendanceSession, BatchAssignment, StudentAttendance, QuizSubmission, AssignmentSubmission, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { verifyBatchOwnership } = require('../../utils/institutionRep.helper');

class ExportReportService {
    async generateBatchReportPdf(batchId, institutionId, res) {
        const batch = await verifyBatchOwnership(batchId, institutionId, {
            include: [
                { model: Course },
                { model: User, as: 'tutors' }
            ]
        });

        // 2. Fetch Students Data in Parallel
        const [totalWorkingDays, totalAssignments, enrollments] = await Promise.all([
            AttendanceSession.count({ where: { batch_id: batchId } }),
            BatchAssignment.count({ where: { batch_id: batchId } }),
            Enrollment.findAll({
                where: { batch_id: batchId },
                include: [{ 
                    model: Student, 
                    as: 'student',
                    attributes: ['id', 'first_name', 'last_name', 'email', 'status', 'created_at'] 
                }]
            })
        ]);

        const enrollmentIds = enrollments.map(e => e.id);

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

        const studentsData = enrollments.map(enrollment => {
            const student = enrollment.student;

            const enrollmentId = enrollment.id;
            const presentCount = presentDaysMap[enrollmentId] || 0;
            const quizAvgVal = quizAvgMap[enrollmentId] || 0;
            const assignmentsCompleted = assignmentsCompletedMap[enrollmentId] || 0;

            let attendancePercent = 0;
            if (totalWorkingDays > 0) {
                attendancePercent = Math.round((presentCount / totalWorkingDays) * 100);
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
                assignments: `${assignmentsCompleted}/${totalAssignments}`,
                status: calculatedStatus,
                rawQuizAvg: quizAvg,
                rawAssignmentsCompleted: assignmentsCompleted,
                rawStatus: calculatedStatus
            };
        });

        // Calculate Batch Averages
        const totalActiveStudents = enrollments.length;
        const totalAtRisk = studentsData.filter(s => s.rawStatus === 'At Risk').length;
        
        let batchAvgScore = 0;
        let batchAssignmentCompletion = 0;
        
        if (totalActiveStudents > 0) {
            const totalQuizAvg = studentsData.reduce((sum, s) => sum + s.rawQuizAvg, 0);
            batchAvgScore = (totalQuizAvg / totalActiveStudents).toFixed(1);
            
            const totalAssignmentsCompleted = studentsData.reduce((sum, s) => sum + s.rawAssignmentsCompleted, 0);
            const totalPossibleAssignments = totalActiveStudents * totalAssignments;
            batchAssignmentCompletion = totalPossibleAssignments > 0 
                ? Math.round((totalAssignmentsCompleted / totalPossibleAssignments) * 100) 
                : 0;
        }

        // 3. Generate PDF
        const doc = new PDFDocument({ margin: 30, size: 'A4' });
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="batch_report_${batch.name.replace(/\s+/g, '_')}.pdf"`);
        doc.pipe(res);

        // Header
        doc.fontSize(20).text('Batch Full Report', { align: 'center' }).moveDown();
        
        doc.fontSize(12).font('Helvetica-Bold').text('Batch Details:');
        doc.font('Helvetica').text(`Batch Name: ${batch.name}`);
        doc.text(`Course Name: ${batch.Course ? batch.Course.title : 'N/A'}`);
        doc.text(`Tutor Name: ${(batch.tutors && batch.tutors.length > 0) ? batch.tutors.map(t => t.first_name + ' ' + t.last_name).join(', ') : 'N/A'}`);
        doc.text(`Total Active Students: ${totalActiveStudents}`).moveDown();
        
        doc.fontSize(12).font('Helvetica-Bold').text('Batch Overview Metrics:');
        doc.font('Helvetica').text(`Batch Average Score: ${batchAvgScore}%`);
        doc.text(`Assignment Completion: ${batchAssignmentCompletion}%`);
        doc.text(`Total At-Risk Students: ${totalAtRisk}`).moveDown(2);

        // Table
        const table = {
            title: "Student List",
            headers: ["Student Name", "Attendance", "Quiz Avg", "Assignments Completed", "Status"],
            rows: studentsData.map(s => [s.name, s.attendance, s.quizAvg, s.assignments, s.status])
        };

        if (studentsData.length > 0) {
            await doc.table(table, {
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
                prepareRow: (row, i) => doc.font("Helvetica").fontSize(10)
            });
        } else {
            doc.text("No students found in this batch.");
        }

        doc.end();
    }
}

module.exports = new ExportReportService();
