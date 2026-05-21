const { sequelize } = require('../src/db/connect');
const tutorPortalService = require('../src/services/tutor-portal.service');
const { Tutor, BatchTutor, Assignment, AssignmentCriteria, AssignmentSubmission, User, Enrollment } = require('../src/models');

async function runTests() {
    try {
        console.log("--- Starting Tutor Assignment Evaluation Tests ---\n");
        await sequelize.authenticate();
        console.log("✅ Database authenticated successfully.");

        // Find tutor
        const tutor = await Tutor.findOne({ where: { email: 'manideeptutor@gmail.com' } });
        if (!tutor) {
            console.error("❌ Test Tutor not found. Run seeders first.");
            process.exit(1);
        }
        console.log(`✅ Found Tutor: ${tutor.full_name} (ID: ${tutor.id})`);

        // Find an assignment submission for assignment 8 or 9 (seeded in batch 30)
        const submission = await AssignmentSubmission.findOne({
            where: { assignment_id: [8, 9] },
            include: [{
                model: Enrollment,
                required: true,
                where: { batch_id: 30 }
            }]
        });

        if (!submission) {
            console.error("❌ Seeded submission for assignment 8 or 9 not found. Please run seeders first.");
            process.exit(1);
        }

        const assignmentId = submission.assignment_id;
        const studentId = submission.student_id;
        const batchId = 30;

        console.log(`✅ Found test submission:`);
        console.log(`   - Submission ID: ${submission.id}`);
        console.log(`   - Assignment ID: ${assignmentId}`);
        console.log(`   - Student ID: ${studentId}`);
        console.log(`   - Batch ID: ${batchId}`);

        // Seed some criteria for this assignment if none exist
        const existingCriteria = await AssignmentCriteria.findAll({ where: { assignment_id: assignmentId } });
        let criteria = existingCriteria;
        if (existingCriteria.length === 0) {
            console.log("ℹ️ No criteria found for this assignment. Seeding default criteria...");
            criteria = await AssignmentCriteria.bulkCreate([
                { assignment_id: assignmentId, criteria_name: 'Code Quality', max_points: 30, description: 'Readable, clean, well-formatted code' },
                { assignment_id: assignmentId, criteria_name: 'Functionality', max_points: 50, description: 'All requirements met correctly' },
                { assignment_id: assignmentId, criteria_name: 'Documentation', max_points: 20, description: 'README file and comments included' }
            ]);
            console.log(`✅ Seeded ${criteria.length} criteria for assignment ${assignmentId}`);
        } else {
            console.log(`ℹ️ Assignment has ${criteria.length} existing criteria.`);
        }

        // Test 1: getAssignmentSubmissionReview (Valid Batch & Student)
        console.log("\n--- Test 1: getAssignmentSubmissionReview (Valid) ---");
        const reviewData = await tutorPortalService.getAssignmentSubmissionReview(tutor.id, assignmentId, studentId, batchId);
        console.log("✅ Review data retrieved successfully.");
        console.log("   - Student Name:", reviewData.studentName);
        console.log("   - Status:", reviewData.result.status);
        console.log("   - Evaluation Matrix size:", reviewData.evaluationMatrix.length);

        if (reviewData.studentName && reviewData.evaluationMatrix.length > 0) {
            console.log("✅ Test 1 Passed: Retrieval works properly.");
        } else {
            console.error("❌ Test 1 Failed: Missing required fields.");
        }

        // Reset the submission status and values before starting evaluation tests
        await submission.update({
            status: 'submitted',
            grade: null,
            feedback: null,
            submission_data: { submissionContent: "Student's solution description", attachments: [] }
        });

        // Test 2: evaluateAssignmentSubmission (Save Draft)
        console.log("\n--- Test 2: evaluateAssignmentSubmission (Save Draft) ---");
        const crit1 = criteria[0];
        const crit2 = criteria[1];
        const draftRatings = [
            { criteria_id: crit1.id, score: 25 },
            { criteria_id: crit2.id, score: 45 }
        ];

        const draftResult = await tutorPortalService.evaluateAssignmentSubmission(tutor.id, assignmentId, studentId, batchId, {
            is_draft: true,
            feedback: "Overall good start, but need documentation.",
            criteria_ratings: draftRatings
        });

        // Query directly from database to verify values
        const dbSubAfterDraft = await AssignmentSubmission.findByPk(submission.id);
        console.log("   - typeof submission_data:", typeof dbSubAfterDraft.submission_data);
        console.log("   - submission_data value:", dbSubAfterDraft.submission_data);
        console.log("   - DB Status after draft:", dbSubAfterDraft.status);
        console.log("   - DB Grade after draft:", dbSubAfterDraft.grade);
        console.log("   - DB Feedback after draft:", dbSubAfterDraft.feedback);
        console.log("   - draftEvaluation in submission_data:", dbSubAfterDraft.submission_data ? dbSubAfterDraft.submission_data.tutor_draft_evaluation : undefined);

        if (
            dbSubAfterDraft.status === 'submitted' &&
            dbSubAfterDraft.grade === null &&
            dbSubAfterDraft.feedback === null &&
            dbSubAfterDraft.submission_data.tutor_draft_evaluation !== undefined &&
            draftResult.isDraft === true &&
            draftResult.result.feedback.comments === "Overall good start, but need documentation."
        ) {
            console.log("✅ Test 2 Passed: Draft saved successfully without publishing to the student.");
        } else {
            console.error("❌ Test 2 Failed: Draft evaluation not stored correctly.");
        }

        // Test 3: evaluateAssignmentSubmission (Publish Final Grades)
        console.log("\n--- Test 3: evaluateAssignmentSubmission (Publish Final) ---");
        const finalRatings = [
            { criteria_id: criteria[0].id, score: 28 },
            { criteria_id: criteria[1].id, score: 47 },
            { criteria_id: criteria[2].id, score: 18 }
        ];

        const finalResult = await tutorPortalService.evaluateAssignmentSubmission(tutor.id, assignmentId, studentId, batchId, {
            is_draft: false,
            feedback: "Excellent work! Well documented and robust solution.",
            criteria_ratings: finalRatings,
            status: 'graded'
        });

        // Query directly from database to verify values
        const dbSubAfterFinal = await AssignmentSubmission.findByPk(submission.id);
        console.log("   - DB Status after publish:", dbSubAfterFinal.status);
        console.log("   - DB Grade after publish:", dbSubAfterFinal.grade); // 28 + 47 + 18 = 93
        console.log("   - DB Feedback after publish:", dbSubAfterFinal.feedback);
        console.log("   - draftEvaluation in submission_data:", dbSubAfterFinal.submission_data.tutor_draft_evaluation);
        console.log("   - tutor_evaluation in submission_data:", dbSubAfterFinal.submission_data.tutor_evaluation);

        if (
            dbSubAfterFinal.status === 'graded' &&
            parseFloat(dbSubAfterFinal.grade) === 93 &&
            dbSubAfterFinal.feedback === "Excellent work! Well documented and robust solution." &&
            dbSubAfterFinal.submission_data.tutor_draft_evaluation === undefined &&
            finalResult.isDraft === false &&
            finalResult.result.obtainedMarks === 93
        ) {
            console.log("✅ Test 3 Passed: Final grades published and draft cleared successfully.");
        } else {
            console.error("❌ Test 3 Failed: Final evaluation not published correctly.");
        }

        // Test 4: evaluateAssignmentSubmission (Resubmit Request)
        console.log("\n--- Test 4: evaluateAssignmentSubmission (Resubmit Request) ---");
        const resubmitResult = await tutorPortalService.evaluateAssignmentSubmission(tutor.id, assignmentId, studentId, batchId, {
            is_draft: false,
            feedback: "Please fix the bugs in functionality and resubmit.",
            criteria_ratings: [
                { criteria_id: criteria[0].id, score: 20 },
                { criteria_id: criteria[1].id, score: 10 }
            ],
            status: 'resubmit_requested'
        });

        // Query database
        const dbSubAfterResubmit = await AssignmentSubmission.findByPk(submission.id);
        console.log("   - DB Status after resubmit:", dbSubAfterResubmit.status);
        console.log("   - DB Grade after resubmit:", dbSubAfterResubmit.grade);
        console.log("   - DB Feedback after resubmit:", dbSubAfterResubmit.feedback);

        if (
            dbSubAfterResubmit.status === 'resubmit_requested' &&
            dbSubAfterResubmit.grade === null &&
            dbSubAfterResubmit.feedback === "Please fix the bugs in functionality and resubmit."
        ) {
            console.log("✅ Test 4 Passed: Resubmit request processed successfully.");
        } else {
            console.error("❌ Test 4 Failed: Resubmit request not processed correctly.");
        }

        // Test 5: Authorization Check (Invalid Batch 10000)
        console.log("\n--- Test 5: Authorization Check (Invalid Batch 10000) ---");
        try {
            await tutorPortalService.getAssignmentSubmissionReview(tutor.id, assignmentId, studentId, 10000);
            console.error("❌ Test 5 Failed: Allowed access on non-allocated batch 10000.");
        } catch (err) {
            if (err.statusCode === 403) {
                console.log("✅ Test 5 Passed: Successfully blocked retrieval for batch 10000:", err.message);
            } else {
                console.error("❌ Test 5 Failed: Threw unexpected error:", err);
            }
        }

        // Test 6: evaluateAssignmentSubmission (Invalid Criteria Score)
        console.log("\n--- Test 6: evaluateAssignmentSubmission (Invalid Score) ---");
        try {
            await tutorPortalService.evaluateAssignmentSubmission(tutor.id, assignmentId, studentId, batchId, {
                is_draft: true,
                criteria_ratings: [{ criteria_id: crit1.id, score: 50 }] // crit1 max is 30
            });
            console.error("❌ Test 6 Failed: Allowed criteria score greater than max points.");
        } catch (err) {
            if (err.statusCode === 400) {
                console.log("✅ Test 6 Passed: Successfully blocked invalid score:", err.message);
            } else {
                console.error("❌ Test 6 Failed: Threw unexpected error:", err);
            }
        }

        console.log("\n--- All Assignment Evaluation Tests Completed ---");

    } catch (err) {
        console.error("❌ Fatal Error during test execution:", err);
    } finally {
        await sequelize.close();
    }
}

runTests();
