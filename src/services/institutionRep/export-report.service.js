const PDFDocument = require('pdfkit-table');
const { Batch, Course, User, Enrollment, Student, AttendanceSession, BatchAssignment, StudentAttendance, QuizSubmission, AssignmentSubmission, sequelize } = require('../../models');
const { Op } = require('sequelize');

class ExportReportService {
    async generateBatchReportPdf(batchId, institutionId, res) {
        // 1. Fetch Batch Data
        const batch = await Batch.findOne({
            where: { id: batchId, institution_id: institutionId },
            include: [
                { model: Course },
                { model: User, as: 'tutors' }
            ]
        });

        if (!batch) {
            const error = new Error('Batch not found or access denied');
            error.statusCode = 404;
            throw error;
        }

        // 2. Fetch Students Data
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

        const studentsData = await Promise.all(enrollments.map(async (enrollment) => {
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
        res.setHeader('Content-Disposition', `attachment; filename="batch_report_${batch.name.replace(/\\s+/g, '_')}.pdf"`);
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
