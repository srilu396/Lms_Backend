const { sequelize } = require('../src/db/connect');
const tutorPortalService = require('../src/services/tutor-portal.service');
const { Tutor, BatchTutor, Batch } = require('../src/models');

async function runTests() {
    try {
        console.log("--- Starting TutorPortalService Verification Tests ---\n");
        await sequelize.authenticate();
        console.log("✅ Database authenticated successfully.");

        // Find tutor
        const tutor = await Tutor.findOne({ where: { email: 'manideeptutor@gmail.com' } });
        if (!tutor) {
            console.error("❌ Test Tutor (manideeptutor@gmail.com) not found in database. Run seeders first.");
            process.exit(1);
        }
        console.log(`✅ Found Tutor: ${tutor.full_name} (ID: ${tutor.id})`);

        // Get tutor's batches
        const assignedBatches = await BatchTutor.findAll({ where: { tutor_id: tutor.id } });
        const batchIds = assignedBatches.map(b => b.batch_id);
        console.log(`✅ Assigned Batches count: ${batchIds.length}, IDs:`, batchIds);

        // Test 1: getAssignmentStats
        console.log("\n--- Test 1: getAssignmentStats ---");
        const assignmentStats = await tutorPortalService.getAssignmentStats(tutor.id);
        console.log("Assignment Stats Result:", assignmentStats);
        if ('total_batches' in assignmentStats && 'total_submissions' in assignmentStats && 'pending_grading' in assignmentStats) {
            console.log("✅ Test 1 Passed: Stats correctly synchronized with all card fields.");
        } else {
            console.error("❌ Test 1 Failed: Missing required stat fields.");
        }

        // Test 2: getQuizStats
        console.log("\n--- Test 2: getQuizStats ---");
        const quizStats = await tutorPortalService.getQuizStats(tutor.id);
        console.log("Quiz Stats Result:", quizStats);
        if ('total_batches' in quizStats && 'total_submissions' in quizStats && 'total_quizzes' in quizStats) {
            console.log("✅ Test 2 Passed: Quiz stats correctly synchronized.");
        } else {
            console.error("❌ Test 2 Failed: Missing quiz stat fields.");
        }

        // Test 3: checkBatchAllocation with valid batch
        console.log("\n--- Test 3: checkBatchAllocation (Valid Batch) ---");
        if (batchIds.length > 0) {
            try {
                await tutorPortalService.checkBatchAllocation(tutor.id, batchIds[0]);
                console.log(`✅ Test 3 Passed: Successfully authorized for assigned batch ${batchIds[0]}`);
            } catch (err) {
                console.error(`❌ Test 3 Failed: Unsuccessfully authorized for assigned batch ${batchIds[0]}`, err);
            }
        } else {
            console.log("⚠️ Skipping Test 3: Tutor has no assigned batches.");
        }

        // Test 4: checkBatchAllocation with invalid batch (10000)
        console.log("\n--- Test 4: checkBatchAllocation (Invalid Batch 10000) ---");
        try {
            await tutorPortalService.checkBatchAllocation(tutor.id, 10000);
            console.error("❌ Test 4 Failed: Allowed access to non-allocated batch 10000.");
        } catch (err) {
            if (err.statusCode === 403) {
                console.log("✅ Test 4 Passed: Correctly threw 403 for batch 10000:", err.message);
            } else {
                console.error("❌ Test 4 Failed: Threw unexpected error:", err);
            }
        }

        // Test 5: getBatchAssignmentStats with invalid batch (10000)
        console.log("\n--- Test 5: getBatchAssignmentStats (Invalid Batch 10000) ---");
        try {
            await tutorPortalService.getBatchAssignmentStats(tutor.id, 10000);
            console.error("❌ Test 5 Failed: Allowed query on non-allocated batch 10000.");
        } catch (err) {
            if (err.statusCode === 403) {
                console.log("✅ Test 5 Passed: Correctly blocked query with 403:", err.message);
            } else {
                console.error("❌ Test 5 Failed: Threw unexpected error:", err);
            }
        }

        // Test 6: getBatchQuizStats with invalid batch (10000)
        console.log("\n--- Test 6: getBatchQuizStats (Invalid Batch 10000) ---");
        try {
            await tutorPortalService.getBatchQuizStats(tutor.id, 10000);
            console.error("❌ Test 6 Failed: Allowed query on non-allocated batch 10000.");
        } catch (err) {
            if (err.statusCode === 403) {
                console.log("✅ Test 6 Passed: Correctly blocked query with 403:", err.message);
            } else {
                console.error("❌ Test 6 Failed: Threw unexpected error:", err);
            }
        }

        // Test 7: getQuizSubmissionReview with invalid batch (10000)
        console.log("\n--- Test 7: getQuizSubmissionReview (Invalid Batch 10000) ---");
        try {
            await tutorPortalService.getQuizSubmissionReview(tutor.id, 1, 1, 10000);
            console.error("❌ Test 7 Failed: Allowed quiz submission review on non-allocated batch 10000.");
        } catch (err) {
            if (err.statusCode === 403) {
                console.log("✅ Test 7 Passed: Correctly blocked quiz review on invalid batch with 403:", err.message);
            } else {
                console.error("❌ Test 7 Failed: Threw unexpected error:", err);
            }
        }

        console.log("\n--- All Service Tests Completed ---");

    } catch (err) {
        console.error("❌ Fatal Error during test execution:", err);
    } finally {
        await sequelize.close();
    }
}

runTests();
