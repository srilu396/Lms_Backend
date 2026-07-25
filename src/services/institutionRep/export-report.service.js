const PDFDocument = require('pdfkit-table');
const { Batch, Course, User, Enrollment, Student, AttendanceSession, BatchAssignment, StudentAttendance, QuizSubmission, AssignmentSubmission, BatchTutor, Tutor, sequelize } = require('../../models');
const { Op } = require('sequelize');
const { verifyBatchOwnership } = require('../../utils/institutionRep.helper');

class ExportReportService {
    async generateBatchReportPdf(batchId, institutionId, res) {
        const batch = await verifyBatchOwnership(batchId, institutionId, {
            include: [
                { model: Course },
                { model: User, as: 'tutors' },
                { 
                    model: BatchTutor, 
                    as: 'batchTutors',
                    include: [{ model: Tutor }]
                }
            ]
        });

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
            const quizAvg = parseFloat(parseFloat(quizAvgResult?.avgScore || 0).toFixed(1));

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
                name: student ? `${student.first_name || ''} ${student.last_name || ''}`.trim() : 'Unknown',
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
        const pdfHelper = require('../../utils/fileGenerators/pdfExportHelper');
        const doc = pdfHelper.createDocument({ margin: 40, size: 'A4' });
        
        const availableWidth = doc.page.width - 80;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="batch_report_${batch.name ? batch.name.replace(/\s+/g, '_') : 'export'}.pdf"`);
        doc.pipe(res);

        let tutorNames = '';
        if (batch.tutors && batch.tutors.length > 0) {
            tutorNames = batch.tutors.map(t => t.full_name || `${t.first_name || ''} ${t.last_name || ''}`.trim()).filter(Boolean).join(', ');
        } else if (batch.batchTutors && batch.batchTutors.length > 0) {
            tutorNames = batch.batchTutors.map(bt => bt.Tutor ? (bt.Tutor.full_name || `${bt.Tutor.first_name || ''} ${bt.Tutor.last_name || ''}`.trim()) : '').filter(Boolean).join(', ');
        }
        if (!tutorNames) tutorNames = 'N/A';

        const courseTitle = batch.Course ? (batch.Course.name || batch.Course.title || 'N/A') : 'N/A';

        pdfHelper.drawHeader(doc, {
            title: 'Batch Comprehensive Report',
            organizationName: 'TRANSETU LMS',
            batchName: batch.name,
            dateGenerated: new Date()
        });

        // Overview Info Box
        pdfHelper.drawSummaryCard(doc, [
            { label: 'Course', value: courseTitle },
            { label: 'Tutor', value: tutorNames },
            { label: 'Active Students', value: String(totalActiveStudents) },
            { label: 'Batch Avg Score', value: `${batchAvgScore}%` },
            { label: 'Assignment Completion', value: `${batchAssignmentCompletion}%` },
            { label: 'At-Risk Count', value: String(totalAtRisk) }
        ]);

        // Table Data
        const table = {
            title: "Student Roster & Performance Summary",
            headers: [
                { label: "Student Name", property: 'name', width: availableWidth * 0.30, headerColor: '#1e293b', color: '#ffffff', align: 'left' },
                { label: "Attendance %", property: 'attendance', width: availableWidth * 0.17, headerColor: '#1e293b', color: '#ffffff', align: 'right' },
                { label: "Quiz Avg %", property: 'quizAvg', width: availableWidth * 0.17, headerColor: '#1e293b', color: '#ffffff', align: 'right' },
                { label: "Assignments", property: 'assignments', width: availableWidth * 0.18, headerColor: '#1e293b', color: '#ffffff', align: 'right' },
                { label: "Status", property: 'status', width: availableWidth * 0.18, headerColor: '#1e293b', color: '#ffffff', align: 'center' }
            ],
            datas: studentsData.map(s => ({
                name: s.name || 'N/A',
                attendance: s.attendance,
                quizAvg: s.quizAvg,
                assignments: s.assignments,
                status: s.status
            }))
        };

        if (studentsData.length > 0) {
            await doc.table(table, {
                x: 40,
                width: availableWidth,
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
                prepareRow: (row, indexColumn, indexRow, rectRow) => {
                    doc.font("Helvetica").fontSize(9).fillColor(pdfHelper.colors.text);
                    if (indexColumn === 0 && indexRow % 2 === 1) {
                        doc.addBackground(rectRow, pdfHelper.colors.lightBg);
                    }
                    if (indexColumn === 4) {
                        const statusVal = typeof row === 'object' && row.status ? row.status : row[4];
                        if (statusVal === 'On Track') {
                            doc.fillColor('#16a34a');
                        } else if (statusVal === 'At Risk') {
                            doc.fillColor('#ea580c');
                        } else if (statusVal === 'Excellent') {
                            doc.fillColor('#2563eb');
                        }
                    }
                }
            });
        } else {
            doc.font('Helvetica').fontSize(10).fillColor(pdfHelper.colors.subtext).text("No students found in this batch.");
        }

        pdfHelper.drawFooters(doc, 'Generated by LMS');
        doc.end();
    }
}

module.exports = new ExportReportService();
