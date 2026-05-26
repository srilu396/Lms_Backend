const { connectDB, sequelize } = require('../src/db/connect');
const { 
    Batch, 
    Enrollment, 
    QuizSubmission, 
    Quiz, 
    AssignmentSubmission, 
    BatchAssignment, 
    AttendanceSession, 
    StudentAttendance,
    Student,
    User
} = require('../src/models');
const { Op } = require('sequelize');

async function _getAverageQuizScore(institutionId, startDate = null, endDate = null) {
    const where = {};
    if (startDate && endDate) {
        where.submitted_at = { [Op.between]: [startDate, endDate] };
    }

    const submissions = await QuizSubmission.findAll({
        where,
        attributes: ['score'],
        include: [
            {
                model: Quiz,
                required: true,
                attributes: ['total_marks']
            },
            {
                model: Enrollment,
                required: true,
                attributes: [],
                include: [{
                    model: Batch,
                    required: true,
                    where: { institution_id: institutionId },
                    attributes: []
                }]
            }
        ],
        raw: true,
        nest: true
    });

    if (submissions.length === 0) return 0;

    let totalPct = 0;
    submissions.forEach(sub => {
        const score = parseFloat(sub.score) || 0;
        const maxMarks = (sub.Quiz && sub.Quiz.total_marks) ? parseFloat(sub.Quiz.total_marks) : 100;
        totalPct += (score / maxMarks) * 100;
    });

    return parseFloat((totalPct / submissions.length).toFixed(1));
}

async function getStats(institutionId) {
    const now = new Date();
    const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const firstDayNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [
        activeCount,
        pendingGraduation,
        avgQuizScoreOverall,
        avgQuizScoreCurrentMonth,
        avgQuizScorePrevMonth,
        batches
    ] = await Promise.all([
        Batch.count({ where: { institution_id: institutionId, status: 'active' } }),
        Batch.count({ where: { institution_id: institutionId, status: 'completed' } }),
        _getAverageQuizScore(institutionId),
        _getAverageQuizScore(institutionId, firstDayThisMonth, firstDayNextMonth),
        _getAverageQuizScore(institutionId, firstDayLastMonth, firstDayThisMonth),
        Batch.findAll({
            where: { institution_id: institutionId },
            attributes: ['id'],
            raw: true
        })
    ]);

    const diff = avgQuizScoreCurrentMonth - avgQuizScorePrevMonth;
    const trendValue = diff.toFixed(1);
    const trendDirection = diff > 0 ? 'up' : (diff < 0 ? 'down' : 'stable');
    const trendFormatted = (diff > 0 ? '+' : '') + trendValue;

    const batchIds = batches.map(b => b.id);

    if (batchIds.length === 0) {
        return {
            avg_quiz_score: {
                value: avgQuizScoreOverall,
                trend: trendFormatted,
                trend_direction: trendDirection
            },
            completion_rate: {
                value: 0,
                label: 'Needs Attention'
            },
            total_batches: {
                active_count: activeCount,
                pending_graduation: pendingGraduation
            },
            at_risk_students: {
                count: 0,
                today_change: 0,
                urgency_label: 'Under control'
            }
        };
    }

    const [
        enrollmentCounts,
        assignmentCounts,
        totalSubmitted,
        enrollments,
        batchSessions
    ] = await Promise.all([
        Enrollment.findAll({
            attributes: ['batch_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            where: { batch_id: { [Op.in]: batchIds } },
            group: ['batch_id'],
            raw: true
        }),
        BatchAssignment.findAll({
            attributes: ['batch_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            where: { batch_id: { [Op.in]: batchIds } },
            group: ['batch_id'],
            raw: true
        }),
        AssignmentSubmission.count({
            include: [{
                model: Enrollment,
                required: true,
                where: { batch_id: { [Op.in]: batchIds } }
            }],
            where: { 
                status: { [Op.in]: ['submitted', 'graded'] } 
            }
        }),
        Enrollment.findAll({
            where: { batch_id: { [Op.in]: batchIds } },
            attributes: ['id', 'batch_id'],
            raw: true
        }),
        AttendanceSession.findAll({
            where: { batch_id: { [Op.in]: batchIds } },
            attributes: ['batch_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            group: ['batch_id'],
            raw: true
        })
    ]);

    let totalAssigned = 0;
    const enrollmentMap = {};
    enrollmentCounts.forEach(ec => {
        enrollmentMap[ec.batch_id] = parseInt(ec.count, 10) || 0;
    });
    const assignmentMap = {};
    assignmentCounts.forEach(ac => {
        assignmentMap[ac.batch_id] = parseInt(ac.count, 10) || 0;
    });

    batchIds.forEach(id => {
        const eCount = enrollmentMap[id] || 0;
        const aCount = assignmentMap[id] || 0;
        totalAssigned += (eCount * aCount);
    });

    const completionRate = totalAssigned > 0 
        ? parseFloat(((totalSubmitted / totalAssigned) * 100).toFixed(1))
        : 0;
    
    let completionLabel = 'Needs Attention';
    if (completionRate >= 90) completionLabel = 'Stable';
    else if (completionRate >= 70) completionLabel = 'Good';

    if (enrollments.length === 0) {
        return {
            avg_quiz_score: {
                value: avgQuizScoreOverall,
                trend: trendFormatted,
                trend_direction: trendDirection
            },
            completion_rate: {
                value: completionRate,
                label: completionLabel
            },
            total_batches: {
                active_count: activeCount,
                pending_graduation: pendingGraduation
            },
            at_risk_students: {
                count: 0,
                today_change: 0,
                urgency_label: 'Under control'
            }
        };
    }

    const enrollmentIds = enrollments.map(e => e.id);
    const [
        quizSubmissions,
        studentAttendances
    ] = await Promise.all([
        QuizSubmission.findAll({
            attributes: ['enrollment_id', 'score'],
            include: [{
                model: Quiz,
                attributes: ['total_marks'],
                required: true
            }],
            where: { enrollment_id: { [Op.in]: enrollmentIds } },
            raw: true,
            nest: true
        }),
        StudentAttendance.findAll({
            attributes: ['enrollment_id', 'status'],
            where: { enrollment_id: { [Op.in]: enrollmentIds } },
            raw: true
        })
    ]);

    const batchSessionMap = {};
    batchSessions.forEach(s => {
        batchSessionMap[s.batch_id] = parseInt(s.count) || 0;
    });

    const quizSubmissionsMap = {};
    quizSubmissions.forEach(sub => {
        if (!quizSubmissionsMap[sub.enrollment_id]) {
            quizSubmissionsMap[sub.enrollment_id] = [];
        }
        quizSubmissionsMap[sub.enrollment_id].push({
            score: sub.score,
            total_marks: sub.Quiz ? sub.Quiz.total_marks : 100
        });
    });

    const attendancesMap = {};
    studentAttendances.forEach(att => {
        if (!attendancesMap[att.enrollment_id]) {
            attendancesMap[att.enrollment_id] = [];
        }
        attendancesMap[att.enrollment_id].push(att);
    });

    let atRiskCount = 0;
    enrollments.forEach(e => {
        let studentAvgScore = 0;
        const subs = quizSubmissionsMap[e.id] || [];
        if (subs.length > 0) {
            let totalPct = 0;
            subs.forEach(sub => {
                const score = parseFloat(sub.score) || 0;
                const maxMarks = (sub.total_marks) ? parseFloat(sub.total_marks) : 100;
                totalPct += (score / maxMarks) * 100;
            });
            studentAvgScore = totalPct / subs.length;
        } else {
            studentAvgScore = 0;
        }

        let attendancePct = 0;
        const totalBatchSessions = batchSessionMap[e.batch_id] || 0;
        if (totalBatchSessions > 0) {
            const studentAtts = attendancesMap[e.id] || [];
            const presentCount = studentAtts.filter(a => a.status === 'present' || a.status === 'late').length;
            attendancePct = (presentCount / totalBatchSessions) * 100;
        } else {
            attendancePct = 100; 
        }

        if (studentAvgScore < 60 || attendancePct < 75) {
            atRiskCount++;
        }
    });

    let urgencyLabel = 'Under control';
    if (atRiskCount > 10) urgencyLabel = 'Needs immediate action';
    else if (atRiskCount > 5) urgencyLabel = 'Monitor closely';

    return {
        avg_quiz_score: {
            value: avgQuizScoreOverall,
            trend: trendFormatted,
            trend_direction: trendDirection
        },
        completion_rate: {
            value: completionRate,
            label: completionLabel
        },
        total_batches: {
            active_count: activeCount,
            pending_graduation: pendingGraduation
        },
        at_risk_students: {
            count: atRiskCount,
            today_change: 0,
            urgency_label: urgencyLabel
        }
    };
}

async function getMonitoringList(institutionId, { page, limit, search, batch_id }) {
    const allBatches = await Batch.findAll({
        where: { institution_id: institutionId },
        attributes: ['id', 'name']
    });

    const batchFilters = allBatches.map(b => ({ batch_id: b.id, batch_name: b.name }));
    let targetBatchIds = allBatches.map(b => b.id);

    if (batch_id && batch_id !== 'all') {
        const selectedBatchId = parseInt(batch_id);
        if (!targetBatchIds.includes(selectedBatchId)) {
            throw new Error('Unauthorized batch access');
        }
        targetBatchIds = [selectedBatchId];
    }

    if (targetBatchIds.length === 0) {
        return {
            students: [],
            batch_filters: batchFilters,
            pagination: { page, limit, total: 0, totalPages: 0 }
        };
    }

    const enrollments = await Enrollment.findAll({
        where: { batch_id: { [Op.in]: targetBatchIds } },
        attributes: ['id', 'student_id', 'batch_id'],
        include: [
            {
                model: Student,
                as: 'student',
                attributes: ['id', 'first_name', 'last_name']
            },
            {
                model: Batch,
                attributes: ['id', 'name']
            }
        ],
        raw: true,
        nest: true
    });

    if (enrollments.length === 0) {
        return {
            students: [],
            batch_filters: batchFilters,
            pagination: { page, limit, total: 0, totalPages: 0 }
        };
    }

    const enrollmentIds = enrollments.map(e => e.id);
    const [
        batchSessions,
        quizSubmissions,
        studentAttendances
    ] = await Promise.all([
        AttendanceSession.findAll({
            where: { batch_id: { [Op.in]: targetBatchIds } },
            attributes: ['batch_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
            group: ['batch_id'],
            raw: true
        }),
        QuizSubmission.findAll({
            attributes: ['enrollment_id', 'score'],
            include: [{
                model: Quiz,
                attributes: ['total_marks'],
                required: true
            }],
            where: { enrollment_id: { [Op.in]: enrollmentIds } },
            raw: true,
            nest: true
        }),
        StudentAttendance.findAll({
            attributes: ['enrollment_id', 'status'],
            where: { enrollment_id: { [Op.in]: enrollmentIds } },
            raw: true
        })
    ]);

    const batchSessionMap = {};
    batchSessions.forEach(s => {
        batchSessionMap[s.batch_id] = parseInt(s.count) || 0;
    });

    const quizSubmissionsMap = {};
    quizSubmissions.forEach(sub => {
        if (!quizSubmissionsMap[sub.enrollment_id]) {
            quizSubmissionsMap[sub.enrollment_id] = [];
        }
        quizSubmissionsMap[sub.enrollment_id].push({
            score: sub.score,
            total_marks: sub.Quiz ? sub.Quiz.total_marks : 100
        });
    });

    const attendancesMap = {};
    studentAttendances.forEach(att => {
        if (!attendancesMap[att.enrollment_id]) {
            attendancesMap[att.enrollment_id] = [];
        }
        attendancesMap[att.enrollment_id].push(att);
    });

    let students = enrollments.map(e => {
        let avgQuizScore = 0;
        const subs = quizSubmissionsMap[e.id] || [];
        if (subs.length > 0) {
            let totalPct = 0;
            subs.forEach(sub => {
                const score = parseFloat(sub.score) || 0;
                const maxMarks = (sub.total_marks) ? parseFloat(sub.total_marks) : 100;
                totalPct += (score / maxMarks) * 100;
            });
            avgQuizScore = parseFloat((totalPct / subs.length).toFixed(1));
        }

        let sessionsAttended = 0;
        let totalSessions = batchSessionMap[e.batch_id] || 0;
        let attendancePercent = 0;

        if (totalSessions > 0) {
            const studentAtts = attendancesMap[e.id] || [];
            sessionsAttended = studentAtts.filter(a => a.status === 'present' || a.status === 'late').length;
            attendancePercent = Math.round((sessionsAttended / totalSessions) * 100);
        } else {
            attendancePercent = 100;
        }

        let status = 'on_track';
        if (avgQuizScore < 50 || attendancePercent < 65) {
            status = 'critical';
        } else if (avgQuizScore < 70 || attendancePercent < 75) {
            status = 'warning';
        }

        return {
            student_id: e.student ? e.student.id : null,
            student_name: e.student ? `${e.student.first_name} ${e.student.last_name}` : 'Unknown',
            avatar_url: null,
            batch_id: e.Batch ? e.Batch.id : null,
            batch_name: e.Batch ? e.Batch.name : 'Unknown',
            avg_quiz_score: avgQuizScore,
            attendance_percent: attendancePercent,
            status: status
        };
    });

    students = students.filter(s => s.status === 'critical' || s.status === 'warning');

    if (search) {
        const lowerSearch = search.toLowerCase();
        students = students.filter(s => s.student_name.toLowerCase().includes(lowerSearch));
    }

    students.sort((a, b) => {
        if (a.status === b.status) {
            return a.avg_quiz_score - b.avg_quiz_score;
        }
        return a.status === 'critical' ? -1 : 1;
    });

    const total = students.length;
    const totalPages = Math.ceil(total / limit);
    const paginatedStudents = students.slice((page - 1) * limit, page * limit);

    return {
        students: paginatedStudents,
        batch_filters: batchFilters,
        pagination: {
            page,
            limit,
            total,
            totalPages
        }
    };
}

async function verify() {
    await connectDB();
    console.log("Connected to DB.");

    const user = await User.findOne({ where: { email: 'kietwomens@gmail.com' } });
    if (!user) {
        console.error("User not found!");
        process.exit(1);
    }
    const instId = user.institution_id;
    console.log(`Using Institution ID: ${instId}`);

    console.log("\n--- Old Service ---");
    const oldService = require('../src/services/institutionRep/dashboard.service');
    console.time("old_getStats");
    const oldStats = await oldService.getStats(instId);
    console.timeEnd("old_getStats");
    console.time("old_getMonitoringList");
    const oldList = await oldService.getMonitoringList(instId, { page: 1, limit: 10, search: '', batch_id: 'all' });
    console.timeEnd("old_getMonitoringList");

    console.log("\n--- Optimized Service ---");
    console.time("opt_getStats");
    const optStats = await getStats(instId);
    console.timeEnd("opt_getStats");
    console.time("opt_getMonitoringList");
    const optList = await getMonitoringList(instId, { page: 1, limit: 10, search: '', batch_id: 'all' });
    console.timeEnd("opt_getMonitoringList");

    console.log("\nChecking stats equality...");
    console.log("stats equal:", JSON.stringify(oldStats) === JSON.stringify(optStats));
    if (JSON.stringify(oldStats) !== JSON.stringify(optStats)) {
        console.log("OLD stats:", JSON.stringify(oldStats, null, 2));
        console.log("OPT stats:", JSON.stringify(optStats, null, 2));
    }

    console.log("\nChecking list equality...");
    console.log("list equal:", JSON.stringify(oldList) === JSON.stringify(optList));
    if (JSON.stringify(oldList) !== JSON.stringify(optList)) {
        console.log("OLD list:", JSON.stringify(oldList, null, 2));
        console.log("OPT list:", JSON.stringify(optList, null, 2));
    }

    process.exit(0);
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
