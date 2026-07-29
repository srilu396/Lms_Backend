const { sequelize } = require('../src/db/connect');
const tutorPortalService = require('../src/services/tutor-portal.service');
const { Tutor, BatchTutor } = require('../src/models');

async function testTutorPortalUpdates() {
    try {
        console.log("=== Testing Tutor Portal Dashboard Updates ===\n");
        await sequelize.authenticate();
        console.log("✅ DB connection successful.\n");

        const tutor = await Tutor.findOne({ where: { email: 'manideeptutor@gmail.com' } });
        if (!tutor) {
            console.log("❌ Test tutor manideeptutor@gmail.com not found. Fetching any tutor...");
            const anyTutor = await Tutor.findOne();
            if (!anyTutor) {
                console.log("❌ No tutor found in DB. Test complete (empty state verified).");
                return;
            }
            await runTestsForTutor(anyTutor);
        } else {
            await runTestsForTutor(tutor);
        }
    } catch (err) {
        console.error("❌ Test error:", err);
    } finally {
        await sequelize.close();
    }
}

async function runTestsForTutor(tutor) {
    console.log(`Tutor: ${tutor.full_name} (ID: ${tutor.id})`);

    // 1.1 Stats API
    console.log("\n--- 1.1 GET /api/v1/tutor-portal/stats ---");
    const stats = await tutorPortalService.getStatsData(tutor.id);
    console.log("Stats Response:", JSON.stringify(stats, null, 2));
    if ('totalAssignedBatches' in stats && 'totalStudents' in stats && 'pendingAssignmentEvaluations' in stats && !('todaySessions' in stats) && !('today_sessions' in stats)) {
        console.log("✅ 1.1 Passed: Only required 3 fields returned with camelCase.");
    } else {
        console.error("❌ 1.1 Failed: Unexpected fields in stats.");
    }

    // 1.2 Dashboard API
    console.log("\n--- 1.2 GET /api/v1/tutor-portal/dashboard ---");
    const dashboard = await tutorPortalService.getDashboardData(tutor.id, { page: 1, limit: 10 });
    console.log("Dashboard Response:", JSON.stringify(dashboard, null, 2));
    if (dashboard.data.length > 0) {
        const item = dashboard.data[0];
        const keys = Object.keys(item);
        if (keys.length === 4 && 'batchId' in item && 'batchName' in item && 'courseName' in item && 'progress' in item) {
            console.log("✅ 1.2 Passed: Returns exactly 4 required fields.");
        } else {
            console.error("❌ 1.2 Failed: Extra or missing fields in batch item:", keys);
        }
    } else {
        console.log("ℹ️ 1.2 Dashboard returned 0 batches for tutor.");
    }

    // 2.1 Quiz Stats API
    console.log("\n--- 2.1 GET /api/v1/tutor-portal/quizzes/stats ---");
    const quizStats = await tutorPortalService.getQuizStats(tutor.id);
    console.log("Quiz Stats Response:", JSON.stringify(quizStats, null, 2));
    if ('totalBatches' in quizStats && 'totalQuizSubmissions' in quizStats && 'averageQuizScore' in quizStats) {
        console.log("✅ 2.1 Passed: Required quiz stats fields present.");
    } else {
        console.error("❌ 2.1 Failed.");
    }

    // 2.2 Quiz Batch List API
    console.log("\n--- 2.2 GET /api/v1/tutor-portal/quizzes ---");
    const quizOverview = await tutorPortalService.getQuizzesOverview(tutor.id, { page: 1, limit: 10 });
    console.log("Quiz Overview Response:", JSON.stringify(quizOverview, null, 2));
    if (quizOverview.data.length > 0) {
        const item = quizOverview.data[0];
        const keys = Object.keys(item);
        if (keys.length === 4 && 'batchId' in item && 'batchName' in item && 'courseName' in item && 'totalQuizzes' in item) {
            console.log("✅ 2.2 Passed: Quiz batch list returns exact 4 required columns.");
        } else {
            console.error("❌ 2.2 Failed: Extra or missing fields:", keys);
        }
    }

    // Find assigned batch for batch-specific tests
    const assignedBatches = await BatchTutor.findAll({ where: { tutor_id: tutor.id } });
    if (assignedBatches.length > 0) {
        const batchId = assignedBatches[0].batch_id;

        // 2.3 Quiz Student Stats API
        console.log(`\n--- 2.3 GET /api/v1/tutor-portal/batch/${batchId}/quiz-stats ---`);
        const batchQuizStats = await tutorPortalService.getBatchQuizStats(tutor.id, batchId);
        console.log("Batch Quiz Stats Response:", JSON.stringify(batchQuizStats, null, 2));

        // 2.4 Student Quiz List API
        console.log(`\n--- 2.4 GET /api/v1/tutor-portal/batch/${batchId}/quizzes ---`);
        const batchStudentQuizzes = await tutorPortalService.getBatchStudentQuizzes(tutor.id, batchId, { page: 1, limit: 10 });
        console.log("Batch Student Quizzes Response:", JSON.stringify(batchStudentQuizzes, null, 2));

        // 3.1 Assignment Stats API
        console.log("\n--- 3.1 GET /api/v1/tutor-portal/assignments/stats ---");
        const assignmentStats = await tutorPortalService.getAssignmentStats(tutor.id);
        console.log("Assignment Stats Response:", JSON.stringify(assignmentStats, null, 2));

        // 3.2 Assignment Batch List API
        console.log("\n--- 3.2 GET /api/v1/tutor-portal/assignments ---");
        const assignmentsOverview = await tutorPortalService.getAssignmentsOverview(tutor.id, { page: 1, limit: 10 });
        console.log("Assignments Overview Response:", JSON.stringify(assignmentsOverview, null, 2));

        // 3.3 Assignment Student Stats API
        console.log(`\n--- 3.3 GET /api/v1/tutor-portal/batch/${batchId}/assignment-stats ---`);
        const batchAssignmentStats = await tutorPortalService.getBatchAssignmentStats(tutor.id, batchId);
        console.log("Batch Assignment Stats Response:", JSON.stringify(batchAssignmentStats, null, 2));

        // 3.4 Student Assignment List API
        console.log(`\n--- 3.4 GET /api/v1/tutor-portal/batch/${batchId}/assignments ---`);
        const batchStudentAssignments = await tutorPortalService.getBatchStudentAssignments(tutor.id, batchId, { page: 1, limit: 10 });
        console.log("Batch Student Assignments Response:", JSON.stringify(batchStudentAssignments, null, 2));
    }
}

testTutorPortalUpdates();
