const axios = require('axios');
const { Course, Module, Lesson, Assignment, Quiz, sequelize } = require('./src/models');

function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`[PASS] ${message}`);
}

async function run() {
    try {
        console.log('--- STARTING HTTP API VERIFICATION ---');

        // Get token
        const loginRes = await axios.post('http://localhost:5001/auth/login', {
            email: 'manideeptutor@gmail.com',
            password: 'P@55word'
        });
        const token = loginRes.data.accessToken || loginRes.data.token || (loginRes.data.data && loginRes.data.data.token);
        const headers = { Authorization: `Bearer ${token}` };

        // Database baseline
        const initialAssignmentCount = await Assignment.count();
        const initialQuizCount = await Quiz.count();

        // Create test resources
        const a1 = await Assignment.create({ title: 'API Assg 1', submission_type: 'text', max_score: 100 });
        const a2 = await Assignment.create({ title: 'API Assg 2', submission_type: 'text', max_score: 100 });
        const a3 = await Assignment.create({ title: 'API Assg 3', submission_type: 'text', max_score: 100 });

        const q1 = await Quiz.create({ name: 'API Quiz 1', status: 'draft' });
        const q2 = await Quiz.create({ name: 'API Quiz 2', status: 'draft' });
        const q3 = await Quiz.create({ name: 'API Quiz 3', status: 'draft' });

        // Seed Course hierarchy
        const course = await Course.create({ name: 'API verification Course', status: 'draft' });
        const mod = await Module.create({ name: 'API verification Module', course_id: course.id, order_num: 1 });
        const les = await Lesson.create({ name: 'API verification Lesson', module_id: mod.id, type: 'text', order_num: 1 });

        const baseUrl = 'http://localhost:5001/api/v1';

        // Helper to get fresh course data
        const getCourseData = async () => {
            const res = await axios.get(`${baseUrl}/courses/${course.id}`, { headers });
            return res.data.data;
        };

        // ── Issue 1: Course root must NOT have quizzes field ───────────────────
        console.log('\n--- Issue 1: Course root must NOT have quizzes field ---');
        let courseData = await getCourseData();
        assert(!('quizzes' in courseData), 'GET /courses/:id response has no "quizzes" field at root (Issue 1)');

        // ── Issue 2: Course assignments must only be course-level rows ─────────
        console.log('\n--- Issue 2: course.assignments must not include module/lesson assignments ---');

        // Link a3 at module level and check it does NOT appear in course.assignments
        await axios.put(`${baseUrl}/modules/${mod.id}`, { assignment_ids: [a3.id] }, { headers });
        courseData = await getCourseData();
        assert(!('quizzes' in courseData), 'No quizzes field after module assignment link (Issue 1)');
        assert(
            !courseData.assignments.some(a => a.id === a3.id),
            'Module assignment (a3) NOT in course.assignments (Issue 2)'
        );
        assert(
            courseData.assignments.every(a => a.module_id === null && a.lesson_id === null),
            'All course.assignments have module_id=null and lesson_id=null (Issue 2)'
        );

        // ── API COURSE LEVEL TESTS ─────────────────────────────────────────────
        console.log('\n--- API COURSE LEVEL TESTS ---');

        // Link
        await axios.put(`${baseUrl}/courses/${course.id}`, { assignment_ids: [a1.id] }, { headers });
        courseData = await getCourseData();
        assert(courseData.assignments && courseData.assignments.some(a => a.id === a1.id), 'Assignment 1 linked to course via API');
        assert(!('quizzes' in courseData), 'No quizzes field after linking course assignment');

        // Replace
        await axios.put(`${baseUrl}/courses/${course.id}`, { assignment_ids: [a2.id] }, { headers });
        courseData = await getCourseData();
        assert(!courseData.assignments.some(a => a.id === a1.id), 'Assignment 1 replaced via API');
        assert(courseData.assignments.some(a => a.id === a2.id), 'Assignment 2 linked to course via API');

        // ── Issue 3: Unlink via [] ─────────────────────────────────────────────
        await axios.put(`${baseUrl}/courses/${course.id}`, { assignment_ids: [] }, { headers });
        courseData = await getCourseData();
        assert(courseData.assignments.length === 0, 'Assignments unlinked via empty array via API');
        // Verify record not deleted
        const dbA2AfterEmpty = await Assignment.findByPk(a2.id);
        assert(dbA2AfterEmpty !== null, 'Assignment 2 record still exists after [] unlink (not deleted)');

        // ── Issue 3: Unlink via null ───────────────────────────────────────────
        await axios.put(`${baseUrl}/courses/${course.id}`, { assignment_ids: [a1.id] }, { headers });
        await axios.put(`${baseUrl}/courses/${course.id}`, { assignment_ids: null }, { headers });
        courseData = await getCourseData();
        assert(courseData.assignments.length === 0, 'Assignments unlinked via null via API');
        // Verify record not deleted
        const dbA1AfterNull = await Assignment.findByPk(a1.id);
        assert(dbA1AfterNull !== null, 'Assignment 1 record still exists after null unlink (not deleted)');

        // ── Issue 4: Verify module assignments stay in modules ─────────────────
        console.log('\n--- Issue 4: Module assignments stay inside their modules ---');
        await axios.put(`${baseUrl}/modules/${mod.id}`, { assignment_ids: [a1.id], quiz_ids: [q1.id] }, { headers });
        courseData = await getCourseData();
        let mData = courseData.modules[0];
        assert(mData.assignments.some(a => a.id === a1.id), 'Assignment 1 linked to module via API');
        assert(mData.quizzes.some(q => q.id === q1.id), 'Quiz 1 linked to module via API (using quiz_ids)');
        assert(!('quizzes' in courseData), 'No quizzes at course root when module has quizzes');
        assert(!courseData.assignments.some(a => a.id === a1.id), 'Module assignment (a1) does NOT appear in course.assignments');

        // Replace
        await axios.put(`${baseUrl}/modules/${mod.id}`, { assignment_ids: [a2.id], quizzes: [q2.id] }, { headers });
        courseData = await getCourseData();
        mData = courseData.modules[0];
        assert(!mData.assignments.some(a => a.id === a1.id), 'Assignment 1 unlinked from module via API');
        assert(mData.assignments.some(a => a.id === a2.id), 'Assignment 2 linked to module via API');
        assert(!mData.quizzes.some(q => q.id === q1.id), 'Quiz 1 unlinked from module via API');
        assert(mData.quizzes.some(q => q.id === q2.id), 'Quiz 2 linked to module via API');

        // Unlink []
        await axios.put(`${baseUrl}/modules/${mod.id}`, { assignment_ids: [], quiz_ids: [] }, { headers });
        courseData = await getCourseData();
        mData = courseData.modules[0];
        assert(mData.assignments.length === 0, 'Module assignments unlinked via empty array via API');
        assert(mData.quizzes.length === 0, 'Module quizzes unlinked via empty array via API');

        // Unlink null
        await axios.put(`${baseUrl}/modules/${mod.id}`, { assignment_ids: [a1.id], quizzes: [q1.id] }, { headers });
        await axios.put(`${baseUrl}/modules/${mod.id}`, { assignment_ids: null, quiz_ids: null }, { headers });
        courseData = await getCourseData();
        mData = courseData.modules[0];
        assert(mData.assignments.length === 0, 'Module assignments unlinked via null via API');
        assert(mData.quizzes.length === 0, 'Module quizzes unlinked via null via API');

        // ── Issue 4: Lesson level ──────────────────────────────────────────────
        console.log('\n--- API LESSON LEVEL TESTS ---');

        // Link
        await axios.put(`${baseUrl}/lessons/${les.id}`, { assignment_ids: [a1.id], quiz_ids: [q1.id] }, { headers });
        courseData = await getCourseData();
        let lData = courseData.modules[0].lessons[0];
        assert(lData.assignments.some(a => a.id === a1.id), 'Assignment 1 linked to lesson via API');
        assert(lData.quizzes.some(q => q.id === q1.id), 'Quiz 1 linked to lesson via API');
        assert(!('quizzes' in courseData), 'No quizzes at course root when lesson has quizzes');
        assert(!courseData.assignments.some(a => a.id === a1.id), 'Lesson assignment (a1) does NOT appear in course.assignments');

        // Replace
        await axios.put(`${baseUrl}/lessons/${les.id}`, { assignment_ids: [a2.id], quizzes: [q2.id] }, { headers });
        courseData = await getCourseData();
        lData = courseData.modules[0].lessons[0];
        assert(!lData.assignments.some(a => a.id === a1.id), 'Assignment 1 unlinked from lesson via API');
        assert(lData.assignments.some(a => a.id === a2.id), 'Assignment 2 linked to lesson via API');
        assert(!lData.quizzes.some(q => q.id === q1.id), 'Quiz 1 unlinked from lesson via API');
        assert(lData.quizzes.some(q => q.id === q2.id), 'Quiz 2 linked to lesson via API');

        // Unlink []
        await axios.put(`${baseUrl}/lessons/${les.id}`, { assignment_ids: [], quiz_ids: [] }, { headers });
        courseData = await getCourseData();
        lData = courseData.modules[0].lessons[0];
        assert(lData.assignments.length === 0, 'Lesson assignments unlinked via empty array via API');
        assert(lData.quizzes.length === 0, 'Lesson quizzes unlinked via empty array via API');

        // Unlink null
        await axios.put(`${baseUrl}/lessons/${les.id}`, { assignment_ids: [a1.id], quizzes: [q1.id] }, { headers });
        await axios.put(`${baseUrl}/lessons/${les.id}`, { assignment_ids: null, quiz_ids: null }, { headers });
        courseData = await getCourseData();
        lData = courseData.modules[0].lessons[0];
        assert(lData.assignments.length === 0, 'Lesson assignments unlinked via null via API');
        assert(lData.quizzes.length === 0, 'Lesson quizzes unlinked via null via API');

        // ── Partial update verification ────────────────────────────────────────
        console.log('\n--- API PARTIAL UPDATE TESTS ---');
        await axios.put(`${baseUrl}/modules/${mod.id}`, { assignment_ids: [a1.id], quizzes: [q1.id] }, { headers });
        await axios.put(`${baseUrl}/modules/${mod.id}`, { name: 'Renamed API Module' }, { headers });
        courseData = await getCourseData();
        mData = courseData.modules[0];
        assert(mData.name === 'Renamed API Module', 'Module renamed');
        assert(mData.assignments.some(a => a.id === a1.id), 'Omitted assignment_ids preserved links');
        assert(mData.quizzes.some(q => q.id === q1.id), 'Omitted quizzes preserved links');

        // ── Cleanup ────────────────────────────────────────────────────────────
        console.log('\n--- CLEANING UP ---');
        await les.destroy();
        await mod.destroy();
        await course.destroy();
        await a1.destroy();
        await a2.destroy();
        await a3.destroy();
        await q1.destroy();
        await q2.destroy();
        await q3.destroy();

        // Count verify
        const finalAssignmentCount = await Assignment.count();
        const finalQuizCount = await Quiz.count();
        assert(finalAssignmentCount === initialAssignmentCount, 'No assignment records hard-deleted');
        assert(finalQuizCount === initialQuizCount, 'No quiz records hard-deleted');

        console.log('\n[SUCCESS] --- ALL HTTP API VERIFICATION TESTS PASSED ---');
    } catch (error) {
        console.error('\n[FAIL] HTTP verification failed:', error.response ? error.response.data : error.message);
        process.exit(1);
    }
}

// Ensure database connection is closed after running
sequelize.authenticate()
    .then(() => run())
    .finally(() => {
        sequelize.close();
    });
