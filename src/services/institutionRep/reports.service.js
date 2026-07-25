const PDFDocument = require('pdfkit-table');
const { Op } = require('sequelize');
const { 
    Institution, Batch, User, Student, Enrollment, Course, 
    StudentAttendance, AttendanceSession, 
    QuizSubmission, AssignmentSubmission, Module, Topic, Lesson, LessonProgress, Quiz, Assignment,
    sequelize
} = require('../../models');
const getRecentReports = async (institutionId, search) => {
    // Fetch the institution to get its name
    const institution = await Institution.findByPk(institutionId);
    if (!institution) {
        throw new Error('Institution not found');
    }

    const institutionName = institution.name;
    const now = new Date();
    // Note: To match "May 20, 2026 • 10:30 AM" we can do:
    const month = now.toLocaleString('en-US', { month: 'long' });
    const day = now.getDate();
    const year = now.getFullYear();
    const time = now.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const formattedDateGenerated = `${month} ${day}, ${year} • ${time}`;

    const reports = [
        {
            report_type: 'attendance',
            title: `${institutionName} Attendance Summary`,
            category: 'ATTENDANCE',
            description: 'Daily and monthly attendance trends by batch',
            date_generated: formattedDateGenerated
        },
        {
            report_type: 'performance',
            title: `${institutionName} Academic Performance Audit`,
            category: 'PERFORMANCE',
            description: 'Detailed quiz scores and overall GPA distributions',
            date_generated: formattedDateGenerated
        },
        {
            report_type: 'progress',
            title: `${institutionName} Batch Progress Overview`,
            category: 'PROGRESS',
            description: 'Track curriculum coverage and completion milestones',
            date_generated: formattedDateGenerated
        },
        {
            report_type: 'at_risk',
            title: `${institutionName} At-Risk Student Analysis`,
            category: 'CRITICAL',
            description: 'Identify students failing to meet minimum criteria',
            date_generated: formattedDateGenerated
        }
    ];

    if (search) {
        const searchLower = search.toLowerCase();
        return reports.filter(r => r.title.toLowerCase().includes(searchLower));
    }

    return reports;
};

const generateReportPdf = async (institutionId, reportType) => {
    const institution = await Institution.findByPk(institutionId);
    if (!institution) {
        throw new Error('Institution not found');
    }

    const today = new Date();
    const todayDateStr = today.toISOString().split('T')[0];
    const filename = `${reportType}_${institution.name.replace(/[^a-zA-Z0-9]/g, '_')}_${todayDateStr}.pdf`;

    const pdfHelper = require('../../utils/fileGenerators/pdfExportHelper');
    const doc = pdfHelper.createDocument({ margin: 40, size: 'A4' });

    const batches = await Batch.findAll({
        where: { institution_id: institutionId },
        include: [
            { model: Course },
            { 
                model: Enrollment,
                include: [
                    { 
                        model: Student, 
                        as: 'student',
                        attributes: ['id', 'first_name', 'last_name', 'email', 'status', 'created_at']
                    }
                ]
            }
        ]
    });

    let earliestDate = today;
    const batchStartDates = batches.map(b => new Date(b.start_date)).filter(d => !isNaN(d));
    if (batchStartDates.length > 0) {
        earliestDate = new Date(Math.min(...batchStartDates));
    }

    let title = '';
    if (reportType === 'attendance') title = 'Attendance Report';
    if (reportType === 'performance') title = 'Performance Report';
    if (reportType === 'progress') title = 'Progress Report';
    if (reportType === 'at_risk') title = 'At-Risk Students Report';

    const periodStr = `${earliestDate.toLocaleDateString()} to ${today.toLocaleDateString()}`;
    pdfHelper.drawHeader(doc, {
        title: title,
        organizationName: institution.name,
        dateGenerated: today,
        datePeriod: periodStr
    });

    const batchIds = batches.map(b => b.id);
    const enrollmentIds = batches.flatMap(b => b.Enrollments ? b.Enrollments.map(e => e.id) : []);
    const courseIds = batches.map(b => b.course_id).filter(id => id);

    const defaultTableOptions = {
        prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
        prepareRow: (row, indexColumn, indexRow, rectRow) => {
            doc.font("Helvetica").fontSize(10);
            if (indexColumn === 0 && indexRow % 2 === 1) {
                doc.addBackground(rectRow, pdfHelper.colors.lightBg);
            }
        }
    };

    if (reportType === 'attendance') {
        const sessions = await AttendanceSession.findAll({
            where: { batch_id: batchIds, session_date: { [Op.lte]: today } }
        });
        const attendances = await StudentAttendance.findAll({
            where: { enrollment_id: enrollmentIds, marked_at: { [Op.lte]: today } }
        });

        const activeStudentsCount = enrollmentIds.length;
        const totalSessionsConducted = sessions.length;
        
        const attendanceRecordsCount = attendances.length;
        const totalPresent = attendances.filter(a => a.status === 'present' || a.status === 'late').length;
        
        const overallAttendanceRate = attendanceRecordsCount ? ((totalPresent / attendanceRecordsCount) * 100).toFixed(1) : 0;

        doc.fontSize(12).font('Helvetica-Bold').fillColor(pdfHelper.colors.primary).text('Section 1 - Institution Overview');
        doc.moveDown(0.3);

        pdfHelper.drawSummaryCard(doc, [
            { label: 'Active Students', value: String(activeStudentsCount) },
            { label: 'Overall Attendance Rate', value: `${overallAttendanceRate}%` },
            { label: 'Total Sessions Conducted', value: String(totalSessionsConducted) }
        ]);

        doc.fontSize(12).font('Helvetica-Bold').fillColor(pdfHelper.colors.primary).text('Section 2 - Batch-wise Attendance Table');
        doc.moveDown(0.3);

        const batchAttendanceRows = [];
        for (const batch of batches) {
            const bSessions = sessions.filter(s => s.batch_id === batch.id);
            const bEnrollments = batch.Enrollments.map(e => e.id);
            const bAttendances = attendances.filter(a => bEnrollments.includes(a.enrollment_id));
            
            let bPresent = bAttendances.filter(a => a.status === 'present' || a.status === 'late').length;
            let bTotal = bAttendances.length;
            
            let avgAtt = 0;
            let status = 'No data yet';
            if (bTotal > 0) {
                avgAtt = (bPresent / bTotal * 100);
                status = avgAtt >= 75 ? 'Good' : 'Needs Attention';
                avgAtt = avgAtt.toFixed(1) + '%';
            } else {
                avgAtt = '0%';
            }

            batchAttendanceRows.push([
                batch.name,
                batch.Course ? batch.Course.title : 'N/A',
                batch.Enrollments.length.toString(),
                bSessions.length.toString(),
                avgAtt,
                status
            ]);
        }

        if (batchAttendanceRows.length > 0) {
            await doc.table({
                headers: [
                    { label: 'Batch', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Course', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Students', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Sessions', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Avg Attendance %', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Status', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white }
                ],
                rows: batchAttendanceRows
            }, defaultTableOptions);
        }
        doc.moveDown(1.5);

        doc.fontSize(12).font('Helvetica-Bold').fillColor(pdfHelper.colors.primary).text('Section 3 - At-Risk Students (< 75% attendance)');
        doc.moveDown(0.3);

        const atRiskRows = [];
        for (const batch of batches) {
            for (const enrollment of batch.Enrollments) {
                const sAttendances = attendances.filter(a => a.enrollment_id === enrollment.id);
                const sTotal = sAttendances.length;
                const sPresent = sAttendances.filter(a => a.status === 'present' || a.status === 'late').length;
                
                if (sTotal > 0) {
                    const sAtt = (sPresent / sTotal * 100);
                    if (sAtt < 75) {
                        atRiskRows.push([
                            enrollment.student ? `${enrollment.student.first_name} ${enrollment.student.last_name}` : 'Unknown',
                            batch.name,
                            sAtt.toFixed(1) + '%',
                            `${sPresent} / ${sTotal}`
                        ]);
                    }
                }
            }
        }

        if (atRiskRows.length > 0) {
            await doc.table({
                headers: [
                    { label: 'Student Name', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Batch', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Attendance %', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Sessions Attended', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white }
                ],
                rows: atRiskRows
            }, defaultTableOptions);
        } else {
            doc.fontSize(10).font('Helvetica').fillColor(pdfHelper.colors.subtext).text('No at-risk students found.');
        }

    } else if (reportType === 'performance') {
        const studentIds = batches.flatMap(b => b.Enrollments ? b.Enrollments.map(e => e.student.id) : []);

        const quizzes = await Quiz.findAll({ where: { course_id: courseIds } });
        const assignments = await Assignment.findAll({ where: { course_id: courseIds } });
        
        const quizSubmissions = await QuizSubmission.findAll({
            where: { student_id: studentIds, submitted_at: { [Op.lte]: today } }
        });
        const assignmentSubmissions = await AssignmentSubmission.findAll({
            where: { student_id: studentIds, submitted_at: { [Op.lte]: today } },
            attributes: ['id', 'student_id', 'enrollment_id', 'status', 'submitted_at']
        });

        const totalQuizzes = quizzes.length;
        let totalAssigned = 0;
        for (const batch of batches) {
            if (batch.course_id) {
                const bAss = assignments.filter(a => a.course_id === batch.course_id).length;
                totalAssigned += (bAss * batch.Enrollments.length);
            }
        }
        const totalSubmitted = assignmentSubmissions.length;
        
        let avgScoreOverall = 0;
        if (quizSubmissions.length > 0) {
            const sumScores = quizSubmissions.reduce((sum, qs) => sum + Number(qs.score_percentage || 0), 0);
            avgScoreOverall = sumScores / quizSubmissions.length;
        }

        doc.fontSize(12).font('Helvetica-Bold').fillColor(pdfHelper.colors.primary).text('Section 1 - Institution Performance Overview');
        doc.moveDown(0.3);

        pdfHelper.drawSummaryCard(doc, [
            { label: 'Overall Avg Quiz Score', value: `${avgScoreOverall.toFixed(1)}%` },
            { label: 'Total Quizzes Conducted', value: String(totalQuizzes) },
            { label: 'Assignments Submitted vs Assigned', value: `${totalSubmitted} / ${totalAssigned}` }
        ]);

        doc.fontSize(12).font('Helvetica-Bold').fillColor(pdfHelper.colors.primary).text('Section 2 - Batch-wise Performance Table');
        doc.moveDown(0.3);

        const batchPerfRows = [];
        const studentStatsMap = new Map();

        for (const batch of batches) {
            const bStudents = batch.Enrollments.map(e => e.student.id);
            const bQS = quizSubmissions.filter(qs => bStudents.includes(qs.student_id));
            const bAS = assignmentSubmissions.filter(as => bStudents.includes(as.student_id));
            const bAssCount = assignments.filter(a => a.course_id === batch.course_id).length;

            let bAvgScore = 0;
            if (bQS.length > 0) {
                bAvgScore = bQS.reduce((sum, qs) => sum + Number(qs.score_percentage || 0), 0) / bQS.length;
            }

            let bAssPerc = 0;
            const bTotalExpectedAss = bAssCount * batch.Enrollments.length;
            if (bTotalExpectedAss > 0) {
                bAssPerc = (bAS.length / bTotalExpectedAss) * 100;
            }

            let topScorer = 'None';
            let topScore = 0;

            for (const enrollment of batch.Enrollments) {
                const sId = enrollment.student.id;
                const sQS = bQS.filter(qs => qs.student_id === sId);
                const sAS = bAS.filter(as => as.student_id === sId);
                
                let sAvg = 0;
                if (sQS.length > 0) {
                    sAvg = sQS.reduce((sum, qs) => sum + Number(qs.score_percentage || 0), 0) / sQS.length;
                }
                
                studentStatsMap.set(sId, {
                    name: enrollment.student ? `${enrollment.student.first_name} ${enrollment.student.last_name}` : 'Unknown',
                    batchName: batch.name,
                    avgScore: sAvg,
                    assCompleted: sAS.length,
                    assTotal: bAssCount
                });

                if (sAvg >= topScore && sQS.length > 0) {
                    topScore = sAvg;
                    topScorer = studentStatsMap.get(sId).name;
                }
            }

            batchPerfRows.push([
                batch.name,
                batch.Course ? batch.Course.title : 'N/A',
                bQS.length > 0 ? bAvgScore.toFixed(1) + '%' : '0%',
                bTotalExpectedAss > 0 ? bAssPerc.toFixed(1) + '%' : '0%',
                topScorer !== 'None' ? `${topScorer} (${topScore.toFixed(1)}%)` : 'N/A'
            ]);
        }

        if (batchPerfRows.length > 0) {
            await doc.table({
                headers: [
                    { label: 'Batch', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Course', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Avg Quiz %', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Assignments %', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Top Scorer', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white }
                ],
                rows: batchPerfRows
            }, defaultTableOptions);
        }
        doc.moveDown(1.5);

        doc.fontSize(12).font('Helvetica-Bold').fillColor(pdfHelper.colors.primary).text('Section 3 - Top 10 Students Table');
        doc.moveDown(0.3);

        const allStudents = Array.from(studentStatsMap.values());
        allStudents.sort((a, b) => b.avgScore - a.avgScore);
        const top10 = allStudents.slice(0, 10);

        const getGrade = (score) => {
            if (score >= 90) return 'A+';
            if (score >= 80) return 'A';
            if (score >= 70) return 'B';
            if (score >= 60) return 'C';
            if (score >= 50) return 'D';
            return 'F';
        };

        const top10Rows = top10.map(s => [
            s.name,
            s.batchName,
            s.avgScore.toFixed(1) + '%',
            `${s.assCompleted} / ${s.assTotal}`,
            getGrade(s.avgScore)
        ]);

        if (top10Rows.length > 0) {
            await doc.table({
                headers: [
                    { label: 'Student Name', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Batch', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Avg Quiz Score', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Assignments Completed', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Grade', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white }
                ],
                rows: top10Rows
            }, defaultTableOptions);
        } else {
            doc.fontSize(10).font('Helvetica').fillColor(pdfHelper.colors.subtext).text('No student performance data available.');
        }
        doc.moveDown(1.5);

        doc.fontSize(12).font('Helvetica-Bold').fillColor(pdfHelper.colors.primary).text('Section 4 - Grade Distribution Summary');
        doc.moveDown(0.3);

        const grades = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
        for (const s of allStudents) {
            if (s.avgScore > 0 || s.assCompleted > 0) {
                grades[getGrade(s.avgScore)]++;
            } else {
                grades['F']++;
            }
        }

        const gradeRows = Object.entries(grades).map(([g, count]) => [g, count.toString()]);
        await doc.table({
            headers: [
                { label: 'Grade', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                { label: 'Student Count', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white }
            ],
            rows: gradeRows
        }, defaultTableOptions);

    } else if (reportType === 'progress') {
        const modules = await Module.findAll({ where: { course_id: courseIds } });
        const moduleIds = modules.map(m => m.id);
        
        let lessons = [];
        if (moduleIds.length > 0) {
            const dbLessons = await sequelize.query(
                'SELECT id, name, module_id FROM lessons WHERE module_id IN (:moduleIds)',
                {
                    replacements: { moduleIds },
                    type: sequelize.QueryTypes.SELECT
                }
            );
            const moduleCourseMap = new Map(modules.map(m => [m.id, m.course_id]));
            lessons = dbLessons.map(l => ({
                id: l.id,
                name: l.name,
                module_id: l.module_id,
                course_id: l.module_id ? moduleCourseMap.get(l.module_id) : null
            }));
        }

        const lessonProgresses = await LessonProgress.findAll({
            where: { enrollment_id: enrollmentIds }
        });

        const totalBatches = batches.length;
        const totalModules = modules.length;
        
        let overallCompletedLessons = 0;
        let overallTotalLessons = 0;

        for (const batch of batches) {
            if (batch.course_id) {
                const bLessonsCount = lessons.filter(l => l.course_id === batch.course_id).length;
                const bEnrollmentIds = batch.Enrollments ? batch.Enrollments.map(e => e.id) : [];
                const bProgress = lessonProgresses.filter(lp => bEnrollmentIds.includes(lp.enrollment_id) && lp.is_completed === true).length;
                
                overallTotalLessons += bLessonsCount;
                overallCompletedLessons += bProgress;
            }
        }

        const overallProgress = overallTotalLessons > 0 ? (overallCompletedLessons / overallTotalLessons * 100).toFixed(1) : 0;

        doc.fontSize(12).font('Helvetica-Bold').fillColor(pdfHelper.colors.primary).text('Section 1 - Institution Progress Overview');
        doc.moveDown(0.3);

        pdfHelper.drawSummaryCard(doc, [
            { label: 'Total Batches', value: String(totalBatches) },
            { label: 'Total Modules', value: String(totalModules) },
            { label: 'Overall Completion', value: `${overallProgress}%` }
        ]);

        doc.fontSize(12).font('Helvetica-Bold').fillColor(pdfHelper.colors.primary).text('Section 2 - Batch-wise Progress Table');
        doc.moveDown(0.3);

        const batchProgressRows = [];
        const moduleStatusData = [];

        for (const batch of batches) {
            const bLessons = lessons.filter(l => l.course_id === batch.course_id);
            const bModules = modules.filter(m => m.course_id === batch.course_id);
            
            const bEnrollmentIds = batch.Enrollments ? batch.Enrollments.map(e => e.id) : [];
            const bProgress = lessonProgresses.filter(lp => bEnrollmentIds.includes(lp.enrollment_id) && lp.is_completed === true);
            
            let bProgressPerc = 0;
            if (bLessons.length > 0) {
                bProgressPerc = (bProgress.length / bLessons.length) * 100;
            }

            const bStart = new Date(batch.start_date);
            const bEnd = new Date(batch.end_date || new Date(bStart.getTime() + 180*24*60*60*1000));
            const elapsed = today.getTime() - bStart.getTime();
            const totalDur = bEnd.getTime() - bStart.getTime();
            const expectedProgress = totalDur > 0 ? (elapsed / totalDur) * 100 : 0;
            
            let status = 'On Track';
            if (bProgressPerc >= 100) {
                status = 'Completed';
            } else if (bProgressPerc < expectedProgress - 10) {
                status = 'Behind';
            }

            let currentModuleName = 'N/A';
            const completedLessonIds = bProgress.map(lp => lp.lesson_id);
            for (const mod of bModules) {
                const modLessons = bLessons.filter(l => l.module_id === mod.id);
                if (modLessons.length > 0) {
                    const modCompleted = modLessons.filter(l => completedLessonIds.includes(l.id)).length;
                    if (modCompleted < modLessons.length) {
                        currentModuleName = mod.title;
                        break;
                    }
                }
            }
            if (currentModuleName === 'N/A' && bModules.length > 0) {
                 currentModuleName = bModules[bModules.length - 1].title;
            }

            batchProgressRows.push([
                batch.name,
                batch.Course ? batch.Course.title : 'N/A',
                batch.start_date ? new Date(batch.start_date).toLocaleDateString() : 'N/A',
                currentModuleName,
                bProgressPerc.toFixed(1) + '%',
                status
            ]);

            for (const mod of bModules) {
                const modLessons = bLessons.filter(l => l.module_id === mod.id);
                let modCompletedCount = 0;
                if (modLessons.length > 0) {
                    modCompletedCount = modLessons.filter(l => completedLessonIds.includes(l.id)).length;
                }
                
                let modPerc = 0;
                let mStatus = 'Not Started';
                if (modLessons.length > 0) {
                    modPerc = (modCompletedCount / modLessons.length) * 100;
                    if (modPerc === 100) mStatus = 'Completed';
                    else if (modPerc > 0) mStatus = 'In Progress';
                }

                moduleStatusData.push([
                    batch.name,
                    mod.title,
                    mStatus,
                    modPerc.toFixed(1) + '%'
                ]);
            }
        }

        if (batchProgressRows.length > 0) {
            await doc.table({
                headers: [
                    { label: 'Batch', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Course', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Start Date', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Current Module', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Progress %', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Status', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white }
                ],
                rows: batchProgressRows
            }, defaultTableOptions);
        }
        doc.moveDown(1.5);

        doc.fontSize(12).font('Helvetica-Bold').fillColor(pdfHelper.colors.primary).text('Section 3 - Module Completion Summary');
        doc.moveDown(0.3);
        if (moduleStatusData.length > 0) {
            await doc.table({
                headers: [
                    { label: 'Batch Name', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Module Name', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Status', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white },
                    { label: 'Completion %', headerColor: pdfHelper.colors.primary, color: pdfHelper.colors.white }
                ],
                rows: moduleStatusData
            }, defaultTableOptions);
        }

    } else if (reportType === 'at_risk') {
        const availableWidth = doc.page.width - 80;

        const studentIds = batches.flatMap(b => b.Enrollments ? b.Enrollments.map(e => e.student ? e.student.id : null).filter(Boolean) : []);
        const enrollmentIds = batches.flatMap(b => b.Enrollments ? b.Enrollments.map(e => e.id) : []);

        const attendances = await StudentAttendance.findAll({
            where: { enrollment_id: enrollmentIds, marked_at: { [Op.lte]: today } }
        });
        
        const quizSubmissions = await QuizSubmission.findAll({
            where: { 
                [Op.or]: [
                    { student_id: studentIds },
                    { enrollment_id: enrollmentIds }
                ],
                submitted_at: { [Op.lte]: today } 
            },
            include: [{ model: Quiz, attributes: ['id', 'total_marks'] }]
        });

        function formatDateDDMMYYYY(dateVal) {
            if (!dateVal) return 'N/A';
            const d = new Date(dateVal);
            if (isNaN(d.getTime())) return 'N/A';
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            return `${day}/${month}/${year}`;
        }

        const atRiskStudentsData = [];
        let attIssuesOnly = 0;
        let quizIssuesOnly = 0;
        let bothIssues = 0;
        
        const batchRiskCounts = new Map();

        for (const batch of batches) {
            let bRiskCount = 0;

            for (const enrollment of batch.Enrollments) {
                const sId = enrollment.student ? enrollment.student.id : null;
                
                const sAttendances = attendances.filter(a => a.enrollment_id === enrollment.id);
                const sTotalAtt = sAttendances.length;
                const sPresent = sAttendances.filter(a => a.status === 'present' || a.status === 'late').length;
                let sAttPerc = 0;
                if (sTotalAtt > 0) {
                    sAttPerc = (sPresent / sTotalAtt) * 100;
                }

                const sQS = quizSubmissions.filter(qs => 
                    (sId && String(qs.student_id) === String(sId)) || 
                    (qs.enrollment_id && String(qs.enrollment_id) === String(enrollment.id))
                );
                
                let sAvgQuiz = 0;
                let hasQuizSubmissions = sQS.length > 0;
                if (hasQuizSubmissions) {
                    const totalQuizScorePct = sQS.reduce((sum, qs) => {
                        let pct = 0;
                        if (qs.score_percentage !== undefined && qs.score_percentage !== null) {
                            pct = Number(qs.score_percentage);
                        } else if (qs.score !== null && qs.score !== undefined) {
                            const scoreVal = Number(qs.score);
                            const totalMarks = (qs.Quiz && Number(qs.Quiz.total_marks)) ? Number(qs.Quiz.total_marks) : 100;
                            pct = (scoreVal / totalMarks) * 100;
                        }
                        return sum + pct;
                    }, 0);
                    sAvgQuiz = totalQuizScorePct / sQS.length;
                }

                let isAttRisk = sAttPerc < 75 && sTotalAtt > 0;
                let isQuizRisk = hasQuizSubmissions ? sAvgQuiz < 60 : false;

                if (isAttRisk || isQuizRisk) {
                    bRiskCount++;
                    let issueType = '';
                    if (isAttRisk && isQuizRisk) {
                        issueType = 'Both';
                        bothIssues++;
                    } else if (isAttRisk) {
                        issueType = 'Attendance';
                        attIssuesOnly++;
                    } else {
                        issueType = 'Quiz';
                        quizIssuesOnly++;
                    }

                    const enrolledDate = batch.start_date 
                        ? formatDateDDMMYYYY(batch.start_date)
                        : formatDateDDMMYYYY(enrollment.created_at);

                    atRiskStudentsData.push({
                        name: enrollment.student ? `${enrollment.student.first_name} ${enrollment.student.last_name}`.trim() : 'Unknown',
                        batch: batch.name || 'N/A',
                        attendance: sTotalAtt > 0 ? sAttPerc.toFixed(1) + '%' : 'N/A',
                        quizAvg: hasQuizSubmissions ? sAvgQuiz.toFixed(1) + '%' : (sAvgQuiz ? sAvgQuiz.toFixed(1) + '%' : '0.0%'),
                        issueType: issueType,
                        enrolledSince: enrolledDate
                    });
                }
            }
            batchRiskCounts.set(batch.id, bRiskCount);
        }

        const totalAtRisk = atRiskStudentsData.length;

        doc.fontSize(12).font('Helvetica-Bold').fillColor(pdfHelper.colors.primary).text('Section 1 - At-Risk Overview');
        doc.moveDown(0.3);

        pdfHelper.drawSummaryCard(doc, [
            { label: 'Total At-Risk Students', value: String(totalAtRisk) },
            { label: 'Attendance Issues', value: String(attIssuesOnly) },
            { label: 'Quiz Issues', value: String(quizIssuesOnly) },
            { label: 'Both Issues', value: String(bothIssues) }
        ]);

        doc.fontSize(12).font('Helvetica-Bold').fillColor(pdfHelper.colors.primary).text('Section 2 - At-Risk Students Table');
        doc.moveDown(0.3);

        if (atRiskStudentsData.length > 0) {
            await doc.table({
                headers: [
                    { label: 'Student Name', property: 'name', width: availableWidth * 0.22, headerColor: '#1e293b', color: '#ffffff', align: 'left' },
                    { label: 'Batch', property: 'batch', width: availableWidth * 0.18, headerColor: '#1e293b', color: '#ffffff', align: 'left' },
                    { label: 'Attendance %', property: 'attendance', width: availableWidth * 0.15, headerColor: '#1e293b', color: '#ffffff', align: 'right' },
                    { label: 'Avg Quiz Score %', property: 'quizAvg', width: availableWidth * 0.15, headerColor: '#1e293b', color: '#ffffff', align: 'right' },
                    { label: 'Issue Type', property: 'issueType', width: availableWidth * 0.15, headerColor: '#1e293b', color: '#ffffff', align: 'left' },
                    { label: 'Enrolled Since', property: 'enrolledSince', width: availableWidth * 0.15, headerColor: '#1e293b', color: '#ffffff', align: 'center' }
                ],
                datas: atRiskStudentsData
            }, {
                x: 40,
                width: availableWidth,
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
                prepareRow: (row, indexColumn, indexRow, rectRow) => {
                    doc.font("Helvetica").fontSize(9);
                    if (indexColumn === 0 && indexRow % 2 === 1) {
                        doc.addBackground(rectRow, pdfHelper.colors.lightBg);
                    }
                }
            });
        } else {
            doc.fontSize(10).font('Helvetica').fillColor(pdfHelper.colors.subtext).text('No at-risk students found.');
        }
        doc.moveDown(1.5);

        doc.fontSize(12).font('Helvetica-Bold').fillColor(pdfHelper.colors.primary).text('Section 3 - Batch-wise At-Risk Summary');
        doc.moveDown(0.3);

        const batchRiskRows = batches.map(batch => {
            const totalSt = batch.Enrollments ? batch.Enrollments.length : 0;
            const bRisk = batchRiskCounts.get(batch.id) || 0;
            const bRiskPerc = totalSt > 0 ? (bRisk / totalSt * 100).toFixed(1) + '%' : '0.0%';
            
            return {
                batch_name: batch.name || 'N/A',
                total_students: String(totalSt),
                at_risk_count: String(bRisk),
                at_risk_pct: bRiskPerc
            };
        });

        if (batchRiskRows.length > 0) {
            await doc.table({
                headers: [
                    { label: 'Batch Name', property: 'batch_name', width: availableWidth * 0.40, headerColor: '#1e293b', color: '#ffffff', align: 'left' },
                    { label: 'Total Students', property: 'total_students', width: availableWidth * 0.20, headerColor: '#1e293b', color: '#ffffff', align: 'right' },
                    { label: 'At-Risk Count', property: 'at_risk_count', width: availableWidth * 0.20, headerColor: '#1e293b', color: '#ffffff', align: 'right' },
                    { label: 'At-Risk %', property: 'at_risk_pct', width: availableWidth * 0.20, headerColor: '#1e293b', color: '#ffffff', align: 'right' }
                ],
                datas: batchRiskRows
            }, {
                x: 40,
                width: availableWidth,
                prepareHeader: () => doc.font("Helvetica-Bold").fontSize(10),
                prepareRow: (row, indexColumn, indexRow, rectRow) => {
                    doc.font("Helvetica").fontSize(9);
                    if (indexColumn === 0 && indexRow % 2 === 1) {
                        doc.addBackground(rectRow, pdfHelper.colors.lightBg);
                    }
                }
            });
        }
    }

    pdfHelper.drawFooters(doc, 'Generated by LMS');
    return { filename, doc };
};

module.exports = {
    getRecentReports,
    generateReportPdf
};
