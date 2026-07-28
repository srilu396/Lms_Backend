const { connectDB } = require('../src/db/connect');
const courseService = require('../src/services/course.service');
const studentService = require('../src/services/student.service');
const institutionService = require('../src/services/institution.service');
const adminService = require('../src/services/admin.service');

async function runVerification() {
    console.log("=== STARTING BACKEND CONSISTENCY VERIFICATION ===");
    await connectDB();

    let passed = true;

    // 1. Course Management API Optimization
    console.log("\n--- 1. Testing Course Listing API Payload Optimization ---");
    const courseRes = await courseService.getCourses({ page: 1, limit: 10 });
    console.log(`Found ${courseRes.data.length} courses (total: ${courseRes.pagination.total})`);

    if (courseRes.data.length > 0) {
        const firstCourse = courseRes.data[0].toJSON ? courseRes.data[0].toJSON() : courseRes.data[0];
        console.log("First course payload keys:", Object.keys(firstCourse));

        const forbiddenFields = [
            'thumbnail_url',
            'final_assessment_id',
            'final_assessment_type',
            'institution_id',
            'total_lessons',
            'total_topics',
            'deleted_at'
        ];

        let foundForbidden = false;
        forbiddenFields.forEach(field => {
            if (firstCourse.hasOwnProperty(field) && firstCourse[field] !== undefined) {
                console.error(`[FAIL] Forbidden field '${field}' found in course response!`);
                foundForbidden = true;
                passed = false;
            }
        });

        if (!foundForbidden) {
            console.log("[PASS] Course response contains ONLY required table fields!");
        }

        if (firstCourse.no_of_modules !== undefined && firstCourse.domain !== undefined) {
            console.log(`[PASS] Required fields 'no_of_modules' (${firstCourse.no_of_modules}) and 'domain' present.`);
        } else {
            console.error("[FAIL] Required field 'no_of_modules' or 'domain' missing!");
            passed = false;
        }
    }

    // 2. Student Management Count Consistency
    console.log("\n--- 2. Testing Student Count & Pagination Consistency ---");
    const studentListRes = await studentService.getStudents({ page: 1, limit: 10 });
    const studentStatsRes = await studentService.getStudentStats();

    console.log(`Student List pagination.total: ${studentListRes.pagination.total}`);
    console.log(`Student Stats total_students:   ${studentStatsRes.total_students}`);
    console.log(`Student List data length:       ${studentListRes.data.length}`);

    if (studentListRes.pagination.total === studentStatsRes.total_students) {
        console.log("[PASS] Student List pagination.total STRICTLY EQUALS Student Stats total_students!");
    } else {
        console.error(`[FAIL] Mismatch! List total (${studentListRes.pagination.total}) != Stats total (${studentStatsRes.total_students})`);
        passed = false;
    }

    if (studentListRes.data.length <= 10 && studentListRes.data.length === Math.min(10, studentListRes.pagination.total)) {
        console.log("[PASS] Student List pagination page length matches expected limit/total ratio.");
    }

    // 3. Institution Count Consistency
    console.log("\n--- 3. Testing Institution Count Consistency Across APIs ---");
    const instListRes = await institutionService.getInstitutions({ page: 1, limit: 10 });
    const instStatsRes = await institutionService.getInstitutionStats();
    const adminDashboardRes = await adminService.getDashboardStats();

    const listTotal = instListRes.meta.total;
    const statsTotal = instStatsRes.totalInstitutions;
    const dashboardTotal = adminDashboardRes.total_institutions;

    console.log(`Institution List meta.total:          ${listTotal}`);
    console.log(`Institution Stats totalInstitutions:   ${statsTotal}`);
    console.log(`Admin Dashboard total_institutions:   ${dashboardTotal}`);
    console.log(`Institution List data length:         ${instListRes.data.length}`);

    if (listTotal === statsTotal && statsTotal === dashboardTotal) {
        console.log(`[PASS] Institution count PERFECT MATCH across all 3 APIs! (${listTotal})`);
    } else {
        console.error(`[FAIL] Mismatch in institution counts: List(${listTotal}), Stats(${statsTotal}), Dashboard(${dashboardTotal})`);
        passed = false;
    }

    if (instListRes.data.length <= 10 && instListRes.data.length === Math.min(10, listTotal)) {
        console.log("[PASS] Institution List pagination page length matches expected limit/total ratio.");
    }

    console.log("\n=== VERIFICATION SUMMARY ===");
    if (passed) {
        console.log("✅ ALL VERIFICATION TESTS PASSED SUCCESSFULLY!");
    } else {
        console.error("❌ SOME VERIFICATION TESTS FAILED!");
        process.exit(1);
    }

    process.exit(0);
}

runVerification().catch(err => {
    console.error("Verification script failed with error:", err);
    process.exit(1);
});
