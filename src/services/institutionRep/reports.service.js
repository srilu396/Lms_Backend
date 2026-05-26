const PDFDocument = require('pdfkit-table');
const { Op } = require('sequelize');
const { 
    Institution, Batch, User, Student, Enrollment, Course, 
    StudentAttendance, AttendanceSession, 
    QuizSubmission, AssignmentSubmission, Module, Topic, Lesson, LessonProgress, Quiz, Assignment 
} = require('../../models');const getRecentReports = async (institutionId, search) => {
    // Fetch the institution to get its name
    const institution = await Institution.findByPk(institutionId, {
        attributes: ['name'],
        raw: true
    });
    if (!institution) {
        throw new Error('Institution not found');
    }

    const institutionName = institution.name;
    const now = new Date();
    // Format: May 20, 2026 • 10:30 AM
    const options = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
    const dateGenerated = new Intl.DateTimeFormat('en-US', options).format(now).replace(', ', ' • ').replace(' AM', ' AM').replace(' PM', ' PM');
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
            date_generated: formattedDateGenerated
        },
        {
            report_type: 'performance',
            title: `${institutionName} Academic Performance Audit`,
            category: 'PERFORMANCE',
            date_generated: formattedDateGenerated
        },
        {
            report_type: 'progress',
            title: `${institutionName} Batch Progress Overview`,
            category: 'PROGRESS',
            date_generated: formattedDateGenerated
        },
        {
            report_type: 'at_risk',
            title: `${institutionName} At-Risk Student Analysis`,
            category: 'CRITICAL',
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

    const doc = new PDFDocument({ margin: 30, size: 'A4', bufferPages: true });

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

    let pageCount = 0;
    doc.on('pageAdded', () => { pageCount++; });

    doc.fontSize(20).font('Helvetica-Bold').text(institution.name, { align: 'center' });
    
    let title = '';
    if (reportType === 'attendance') title = 'Attendance Report';
    if (reportType === 'performance') title = 'Performance Report';
    if (reportType === 'progress') title = 'Progress Report';
    if (reportType === 'at_risk') title = 'At-Risk Students Report';
    
    doc.fontSize(16).font('Helvetica').text(title, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica').text(`Generated: ${today.toLocaleString()}`, { align: 'center' });
    doc.text(`Data Period: ${earliestDate.toLocaleDateString()} to ${today.toLocaleDateString()}`, { align: 'center' });
    doc.moveDown(2);

    const batchIds = batches.map(b => b.id);
    const enrollmentIds = batches.flatMap(b => b.Enrollments ? b.Enrollments.map(e => e.id) : []);
    const courseIds = batches.map(b => b.course_id).filter(id => id);

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

        doc.fontSize(14).font('Helvetica-Bold').text('Section 1 - Institution Overview');
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica').text(`Total active students across all batches: ${activeStudentsCount}`);
        doc.text(`Overall attendance rate: ${overallAttendanceRate}%`);
        doc.text(`Total sessions conducted across all batches: ${totalSessionsConducted}`);
        doc.moveDown(1.5);

        doc.fontSize(14).font('Helvetica-Bold').text('Section 2 - Batch-wise Attendance Table');
        doc.moveDown(0.5);

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
                headers: ['Batch', 'Course', 'Students', 'Sessions', 'Avg Attendance %', 'Status'],
                rows: batchAttendanceRows
            }, { width: 500 });
        }
        doc.moveDown(1.5);

        doc.fontSize(14).font('Helvetica-Bold').text('Section 3 - At-Risk Students (< 75% attendance)');
        doc.moveDown(0.5);

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
                headers: ['Student Name', 'Batch', 'Attendance %', 'Sessions Attended'],
                rows: atRiskRows
            }, { width: 500 });
        } else {
            doc.fontSize(11).font('Helvetica').text('No at-risk students found.');
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

        doc.fontSize(14).font('Helvetica-Bold').text('Section 1 - Institution Performance Overview');
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica').text(`Overall Avg Quiz Score: ${avgScoreOverall.toFixed(1)}%`);
        doc.text(`Total Quizzes Conducted: ${totalQuizzes}`);
        doc.text(`Assignments Submitted vs Assigned: ${totalSubmitted} / ${totalAssigned}`);
        doc.moveDown(1.5);

        doc.fontSize(14).font('Helvetica-Bold').text('Section 2 - Batch-wise Performance Table');
        doc.moveDown(0.5);

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
                bQS.length > 0 ? bAvgScore.toFixed(1) + '%' : '0% (No submissions yet)',
                bTotalExpectedAss > 0 ? bAssPerc.toFixed(1) + '%' : '0%',
                topScorer !== 'None' ? `${topScorer} (${topScore.toFixed(1)}%)` : 'N/A'
            ]);
        }

        if (batchPerfRows.length > 0) {
            await doc.table({
                headers: ['Batch', 'Course', 'Avg Quiz %', 'Assignments Completed %', 'Top Scorer'],
                rows: batchPerfRows
            }, { width: 500 });
        }
        doc.moveDown(1.5);

        doc.fontSize(14).font('Helvetica-Bold').text('Section 3 - Top 10 Students Table');
        doc.moveDown(0.5);

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
                headers: ['Student Name', 'Batch', 'Avg Quiz Score', 'Assignments Completed', 'Grade'],
                rows: top10Rows
            }, { width: 500 });
        } else {
            doc.fontSize(11).font('Helvetica').text('No student performance data available.');
        }
        doc.moveDown(1.5);

        doc.fontSize(14).font('Helvetica-Bold').text('Section 4 - Grade Distribution Summary');
        doc.moveDown(0.5);

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
            headers: ['Grade', 'Student Count'],
            rows: gradeRows
        }, { width: 250 });

    } else if (reportType === 'progress') {
        const modules = await Module.findAll({ where: { course_id: courseIds } });
        const moduleIds = modules.map(m => m.id);
        const topics = await Topic.findAll({ where: { module_id: moduleIds } });
        const topicIds = topics.map(t => t.id);
        const dbLessons = await Lesson.findAll({ where: { topic_id: topicIds } });

        const topicModuleMap = new Map(topics.map(t => [t.id, t.module_id]));
        const moduleCourseMap = new Map(modules.map(m => [m.id, m.course_id]));
        
        const lessons = dbLessons.map(l => {
            const mId = topicModuleMap.get(l.topic_id);
            l.course_id = mId ? moduleCourseMap.get(mId) : null;
            return l;
        });
        
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

        doc.fontSize(14).font('Helvetica-Bold').text('Section 1 - Institution Progress Overview');
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica').text(`Total batches: ${totalBatches}`);
        doc.text(`Total modules across all courses: ${totalModules}`);
        doc.text(`Overall course completion: ${overallProgress}%`);
        doc.moveDown(1.5);

        doc.fontSize(14).font('Helvetica-Bold').text('Section 2 - Batch-wise Progress Table');
        doc.moveDown(0.5);

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

            // Simple status calculation based on elapsed time vs progress
            const bStart = new Date(batch.start_date);
            const bEnd = new Date(batch.end_date || new Date(bStart.getTime() + 180*24*60*60*1000)); // default 6mo
            const elapsed = today.getTime() - bStart.getTime();
            const totalDur = bEnd.getTime() - bStart.getTime();
            const expectedProgress = totalDur > 0 ? (elapsed / totalDur) * 100 : 0;
            
            let status = 'On Track';
            if (bProgressPerc >= 100) {
                status = 'Completed';
            } else if (bProgressPerc < expectedProgress - 10) { // 10% buffer
                status = 'Behind';
            }

            // Determine current module
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
                 currentModuleName = bModules[bModules.length - 1].title; // last module if all done
            }

            batchProgressRows.push([
                batch.name,
                batch.Course ? batch.Course.title : 'N/A',
                batch.start_date ? new Date(batch.start_date).toLocaleDateString() : 'N/A',
                currentModuleName,
                bProgressPerc.toFixed(1) + '%',
                status
            ]);

            // Module completion summary for Section 3
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
                headers: ['Batch', 'Course', 'Start Date', 'Current Module', 'Progress %', 'Status'],
                rows: batchProgressRows
            }, { width: 500 });
        }
        doc.moveDown(1.5);

        doc.fontSize(14).font('Helvetica-Bold').text('Section 3 - Module Completion Summary');
        doc.moveDown(0.5);
        if (moduleStatusData.length > 0) {
             await doc.table({
                headers: ['Batch Name', 'Module Name', 'Status', 'Completion %'],
                rows: moduleStatusData
            }, { width: 500 });
        }

    } else if (reportType === 'at_risk') {
        const studentIds = batches.flatMap(b => b.Enrollments ? b.Enrollments.map(e => e.student.id) : []);

        const attendances = await StudentAttendance.findAll({
            where: { enrollment_id: batches.flatMap(b => b.Enrollments ? b.Enrollments.map(e => e.id) : []), marked_at: { [Op.lte]: today } }
        });
        
        const quizSubmissions = await QuizSubmission.findAll({
            where: { student_id: studentIds, submitted_at: { [Op.lte]: today } }
        });

        const atRiskStudentsData = [];
        let attIssuesOnly = 0;
        let quizIssuesOnly = 0;
        let bothIssues = 0;
        
        const batchRiskCounts = new Map();

        for (const batch of batches) {
            let bRiskCount = 0;

            for (const enrollment of batch.Enrollments) {
                const sId = enrollment.student.id;
                
                const sAttendances = attendances.filter(a => a.enrollment_id === enrollment.id);
                const sTotalAtt = sAttendances.length;
                const sPresent = sAttendances.filter(a => a.status === 'present' || a.status === 'late').length;
                let sAttPerc = 100;
                if (sTotalAtt > 0) {
                    sAttPerc = (sPresent / sTotalAtt) * 100;
                }

                const sQS = quizSubmissions.filter(qs => qs.student_id === sId);
                let sAvgQuiz = 100; // Assume good if no quizzes
                if (sQS.length > 0) {
                    sAvgQuiz = sQS.reduce((sum, qs) => sum + Number(qs.score_percentage || 0), 0) / sQS.length;
                }

                let isAttRisk = sAttPerc < 75 && sTotalAtt > 0;
                let isQuizRisk = sAvgQuiz < 60 && sQS.length > 0;

                if (isAttRisk || isQuizRisk) {
                    bRiskCount++;
                    let issues = [];
                    if (isAttRisk && isQuizRisk) {
                        issues.push('Both');
                        bothIssues++;
                    } else if (isAttRisk) {
                        issues.push('Attendance');
                        attIssuesOnly++;
                    } else {
                        issues.push('Quiz');
                        quizIssuesOnly++;
                    }

                    atRiskStudentsData.push([
                        enrollment.student ? `${enrollment.student.first_name} ${enrollment.student.last_name}` : 'Unknown',
                        batch.name,
                        sTotalAtt > 0 ? sAttPerc.toFixed(1) + '%' : 'N/A',
                        sQS.length > 0 ? sAvgQuiz.toFixed(1) + '%' : 'N/A',
                        issues.join(', '),
                        batch.start_date ? new Date(batch.start_date).toLocaleDateString() : 'N/A'
                    ]);
                }
            }
            batchRiskCounts.set(batch.id, bRiskCount);
        }

        const totalAtRisk = atRiskStudentsData.length;

        doc.fontSize(14).font('Helvetica-Bold').text('Section 1 - At-Risk Overview');
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica').text(`Total at-risk students: ${totalAtRisk}`);
        doc.text(`Breakdown: Attendance issues only (${attIssuesOnly}), Quiz issues only (${quizIssuesOnly}), Both issues (${bothIssues})`);
        doc.moveDown(1.5);

        doc.fontSize(14).font('Helvetica-Bold').text('Section 2 - At-Risk Students Table');
        doc.moveDown(0.5);

        if (atRiskStudentsData.length > 0) {
            await doc.table({
                headers: ['Student Name', 'Batch', 'Attendance %', 'Avg Quiz %', 'Issues', 'Enrolled Since'],
                rows: atRiskStudentsData
            }, { width: 500 });
        } else {
            doc.fontSize(11).font('Helvetica').text('No at-risk students found.');
        }
        doc.moveDown(1.5);

        doc.fontSize(14).font('Helvetica-Bold').text('Section 3 - Batch-wise At-Risk Summary');
        doc.moveDown(0.5);

        const batchRiskRows = [];
        for (const batch of batches) {
            const totalSt = batch.Enrollments.length;
            const bRisk = batchRiskCounts.get(batch.id) || 0;
            const bRiskPerc = totalSt > 0 ? (bRisk / totalSt * 100).toFixed(1) + '%' : '0%';
            
            batchRiskRows.push([
                batch.name,
                totalSt.toString(),
                bRisk.toString(),
                bRiskPerc
            ]);
        }

        if (batchRiskRows.length > 0) {
            await doc.table({
                headers: ['Batch Name', 'Total Students', 'At-Risk Count', 'At-Risk %'],
                rows: batchRiskRows
            }, { width: 400 });
        }
    }

    // Add page numbers
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(10).font('Helvetica').text(
            `Page ${i + 1} of ${pages.count}`,
            0,
            doc.page.height - 30,
            { align: 'center' }
        );
    }

    return { filename, doc };
};

module.exports = {
    getRecentReports,
    generateReportPdf
};
