const courseService = require('./src/services/course.service');
const moduleService = require('./src/services/courseModule.service');
const lessonService = require('./src/services/lesson.service');
const { Course, Module, Lesson, Assignment, Quiz, sequelize } = require('./src/models');

function assert(condition, message) {
    if (!condition) {
        throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`[PASS] ${message}`);
}

async function verify() {
    try {
        console.log('--- STARTING PROGRAMMATIC VERIFICATION ---');

        // Clean up or find reference counts
        const initialAssignmentCount = await Assignment.count();
        const initialQuizCount = await Quiz.count();
        console.log(`Initial DB State - Assignments: ${initialAssignmentCount}, Quizzes: ${initialQuizCount}`);

        // 1. Create assignments and quizzes for testing
        const a1 = await Assignment.create({ title: 'Assoc Assg 1', submission_type: 'text', max_score: 100 });
        const a2 = await Assignment.create({ title: 'Assoc Assg 2', submission_type: 'text', max_score: 100 });
        const a3 = await Assignment.create({ title: 'Assoc Assg 3', submission_type: 'text', max_score: 100 });

        const q1 = await Quiz.create({ name: 'Assoc Quiz 1', status: 'draft' });
        const q2 = await Quiz.create({ name: 'Assoc Quiz 2', status: 'draft' });
        const q3 = await Quiz.create({ name: 'Assoc Quiz 3', status: 'draft' });

        const newAssignmentCount = await Assignment.count();
        const newQuizCount = await Quiz.count();
        assert(newAssignmentCount === initialAssignmentCount + 3, '3 new assignments created');
        assert(newQuizCount === initialQuizCount + 3, '3 new quizzes created');

        // 2. Create Course, Module, Lesson
        console.log('\n--- Seeding Course, Module, Lesson ---');
        const course = await courseService.createCourse({
            name: 'Verification Course',
            description: 'A course for verification testing',
            status: 'draft',
            modules: [
                {
                    name: 'Module 1',
                    order_num: 1,
                    lessons: [
                        {
                            name: 'Lesson 1',
                            type: 'text',
                            order_num: 1
                        }
                    ]
                }
            ]
        });

        assert(course.id !== undefined, 'Course created');
        const module1 = course.modules[0];
        assert(module1.id !== undefined, 'Module created');
        const lesson1 = module1.lessons[0];
        assert(lesson1.id !== undefined, 'Lesson created');

        // ── Issue 1: Course response must not contain a quizzes field ──────────
        console.log('\n--- Issue 1: Course root must NOT have quizzes field ---');
        let freshCourse = await courseService.getCourseById(course.id);
        assert(!('quizzes' in freshCourse), 'Course root has no "quizzes" field (Issue 1)');

        // ── Issue 2: Course assignments must only be course-level assignments ──
        console.log('\n--- Issue 2: data.assignments must only contain course-level assignments ---');

        // Link a module-level assignment (a3) to verify it does NOT bleed into course.assignments
        await moduleService.updateModule(module1.id, { assignment_ids: [a3.id] });

        freshCourse = await courseService.getCourseById(course.id);
        assert(
            !freshCourse.assignments.some(a => a.id === a3.id),
            'Module assignment (a3) does NOT appear in course.assignments (Issue 2)'
        );
        assert(
            freshCourse.assignments.every(a => a.module_id === null && a.lesson_id === null),
            'All items in course.assignments have module_id=null and lesson_id=null (Issue 2)'
        );

        // ── Issue 3 & 4: Course Level Update: Link Assignment ──────────────────
        console.log('\n--- Course Level: Link Assignment ---');
        await courseService.updateCourse(course.id, { assignment_ids: [a1.id] });
        let dbA1 = await Assignment.findByPk(a1.id);
        assert(dbA1.course_id === course.id, 'Assignment 1 linked to course');
        assert(dbA1.module_id === null && dbA1.lesson_id === null, 'Assignment 1 has no module/lesson link');

        freshCourse = await courseService.getCourseById(course.id);
        assert(freshCourse.assignments.some(a => a.id === a1.id), 'a1 appears in course.assignments after link');
        assert(!('quizzes' in freshCourse), 'Course root still has no "quizzes" field after linking assignment');

        // ── Course Level Update: Replace Assignment ────────────────────────────
        console.log('\n--- Course Level: Replace Assignment ---');
        await courseService.updateCourse(course.id, { assignment_ids: [a2.id] });
        dbA1 = await Assignment.findByPk(a1.id);
        let dbA2 = await Assignment.findByPk(a2.id);
        assert(dbA1.course_id === null, 'Assignment 1 unlinked from course (replaced)');
        assert(dbA2.course_id === course.id, 'Assignment 2 linked to course');

        // ── Issue 3: Remove Assignment via empty array ─────────────────────────
        console.log('\n--- Issue 3: Remove Course Assignment via assignment_ids: [] ---');
        await courseService.updateCourse(course.id, { assignment_ids: [] });
        dbA2 = await Assignment.findByPk(a2.id);
        assert(dbA2.course_id === null, 'Assignment 2 unlinked from course (empty array)');
        assert(dbA2 !== null, 'Assignment 2 record still exists in DB (not deleted)');

        freshCourse = await courseService.getCourseById(course.id);
        assert(freshCourse.assignments.length === 0, 'course.assignments is empty after [] removal');

        // ── Issue 3: Remove Assignment via null ────────────────────────────────
        console.log('\n--- Issue 3: Remove Course Assignment via assignment_ids: null ---');
        await courseService.updateCourse(course.id, { assignment_ids: [a1.id] });
        dbA1 = await Assignment.findByPk(a1.id);
        assert(dbA1.course_id === course.id, 'Assignment 1 re-linked to course for null test');

        await courseService.updateCourse(course.id, { assignment_ids: null });
        dbA1 = await Assignment.findByPk(a1.id);
        assert(dbA1.course_id === null, 'Assignment 1 unlinked from course (null)');
        assert(dbA1 !== null, 'Assignment 1 record still exists in DB (not deleted)');

        freshCourse = await courseService.getCourseById(course.id);
        assert(freshCourse.assignments.length === 0, 'course.assignments is empty after null removal');

        // ── Verify Module assignments unaffected by course-level unlink ────────
        console.log('\n--- Verify Module assignments unaffected by course-level unlink ---');
        let dbA3 = await Assignment.findByPk(a3.id);
        assert(dbA3.module_id === module1.id, 'Module assignment (a3) still linked to module1 after course unlink');
        freshCourse = await courseService.getCourseById(course.id);
        assert(!freshCourse.assignments.some(a => a.id === a3.id), 'Module assignment (a3) does not appear in course.assignments');

        // ── Module Level: Link Assignment & Quiz ───────────────────────────────
        console.log('\n--- Module Level: Link Assignment & Quiz ---');
        await moduleService.updateModule(module1.id, { assignment_ids: [a1.id], quiz_ids: [q1.id] });
        dbA1 = await Assignment.findByPk(a1.id);
        let dbQ1 = await Quiz.findByPk(q1.id);
        assert(dbA1.module_id === module1.id && dbA1.course_id === course.id, 'Assignment 1 linked to module');
        assert(dbQ1.module_id === module1.id && dbQ1.course_id === course.id, 'Quiz 1 linked to module');

        // Verify module quiz is nested inside module, not at course root
        freshCourse = await courseService.getCourseById(course.id);
        assert(!('quizzes' in freshCourse), 'No quizzes at course root even when module has quizzes');
        const freshModule1 = freshCourse.modules.find(m => m.id === module1.id);
        assert(freshModule1.quizzes.some(q => q.id === q1.id), 'Quiz 1 appears inside its module');
        assert(!freshCourse.assignments.some(a => a.id === a1.id), 'Module assignment (a1) does NOT bleed into course.assignments');

        // Replace
        console.log('\n--- Module Level: Replace Assignment & Quiz ---');
        await moduleService.updateModule(module1.id, { assignment_ids: [a2.id], quizzes: [q2.id] });
        dbA1 = await Assignment.findByPk(a1.id);
        dbA2 = await Assignment.findByPk(a2.id);
        dbQ1 = await Quiz.findByPk(q1.id);
        let dbQ2 = await Quiz.findByPk(q2.id);
        assert(dbA1.module_id === null && dbA1.course_id === null, 'Assignment 1 unlinked from module');
        assert(dbA2.module_id === module1.id && dbA2.course_id === course.id, 'Assignment 2 linked to module');
        assert(dbQ1.module_id === null && dbQ1.course_id === null, 'Quiz 1 unlinked from module');
        assert(dbQ2.module_id === module1.id && dbQ2.course_id === course.id, 'Quiz 2 linked to module');

        // Remove (empty array)
        console.log('\n--- Module Level: Remove Assignment & Quiz (empty array) ---');
        await moduleService.updateModule(module1.id, { assignment_ids: [], quiz_ids: [] });
        dbA2 = await Assignment.findByPk(a2.id);
        dbQ2 = await Quiz.findByPk(q2.id);
        assert(dbA2.module_id === null && dbA2.course_id === null, 'Assignment 2 unlinked (empty array)');
        assert(dbQ2.module_id === null && dbQ2.course_id === null, 'Quiz 2 unlinked (empty array)');

        // Remove (null)
        console.log('\n--- Module Level: Remove Assignment & Quiz (null) ---');
        await moduleService.updateModule(module1.id, { assignment_ids: [a1.id], quizzes: [q1.id] });
        dbA1 = await Assignment.findByPk(a1.id);
        dbQ1 = await Quiz.findByPk(q1.id);
        assert(dbA1.module_id === module1.id, 'Assignment 1 linked back');
        assert(dbQ1.module_id === module1.id, 'Quiz 1 linked back');

        await moduleService.updateModule(module1.id, { assignment_ids: null, quiz_ids: null });
        dbA1 = await Assignment.findByPk(a1.id);
        dbQ1 = await Quiz.findByPk(q1.id);
        assert(dbA1.module_id === null && dbA1.course_id === null, 'Assignment 1 unlinked (null)');
        assert(dbQ1.module_id === null && dbQ1.course_id === null, 'Quiz 1 unlinked (null)');

        // ── Lesson Level: Link Assignment & Quiz ───────────────────────────────
        console.log('\n--- Lesson Level: Link Assignment & Quiz ---');
        await lessonService.updateLesson(lesson1.id, { assignment_ids: [a1.id], quiz_ids: [q1.id] });
        dbA1 = await Assignment.findByPk(a1.id);
        dbQ1 = await Quiz.findByPk(q1.id);
        assert(dbA1.lesson_id === lesson1.id && dbA1.module_id === module1.id && dbA1.course_id === course.id, 'Assignment 1 linked to lesson');
        assert(dbQ1.lesson_id === lesson1.id && dbQ1.module_id === module1.id && dbQ1.course_id === course.id, 'Quiz 1 linked to lesson');

        // Verify lesson quiz is nested inside lesson, not at course root
        freshCourse = await courseService.getCourseById(course.id);
        assert(!('quizzes' in freshCourse), 'No quizzes at course root even when lesson has quizzes');
        const freshLesson1 = freshCourse.modules.find(m => m.id === module1.id).lessons.find(l => l.id === lesson1.id);
        assert(freshLesson1.quizzes.some(q => q.id === q1.id), 'Quiz 1 appears inside its lesson');
        assert(!freshCourse.assignments.some(a => a.id === a1.id), 'Lesson assignment (a1) does NOT bleed into course.assignments');

        // Replace
        console.log('\n--- Lesson Level: Replace Assignment & Quiz ---');
        await lessonService.updateLesson(lesson1.id, { assignment_ids: [a2.id], quizzes: [q2.id] });
        dbA1 = await Assignment.findByPk(a1.id);
        dbA2 = await Assignment.findByPk(a2.id);
        dbQ1 = await Quiz.findByPk(q1.id);
        dbQ2 = await Quiz.findByPk(q2.id);
        assert(dbA1.lesson_id === null && dbA1.module_id === null && dbA1.course_id === null, 'Assignment 1 unlinked from lesson');
        assert(dbA2.lesson_id === lesson1.id && dbA2.module_id === module1.id && dbA2.course_id === course.id, 'Assignment 2 linked to lesson');
        assert(dbQ1.lesson_id === null && dbQ1.module_id === null && dbQ1.course_id === null, 'Quiz 1 unlinked from lesson');
        assert(dbQ2.lesson_id === lesson1.id && dbQ2.module_id === module1.id && dbQ2.course_id === course.id, 'Quiz 2 linked to lesson');

        // Remove
        console.log('\n--- Lesson Level: Remove Assignment & Quiz (empty array) ---');
        await lessonService.updateLesson(lesson1.id, { assignment_ids: [], quiz_ids: [] });
        dbA2 = await Assignment.findByPk(a2.id);
        dbQ2 = await Quiz.findByPk(q2.id);
        assert(dbA2.lesson_id === null && dbA2.module_id === null && dbA2.course_id === null, 'Assignment 2 unlinked from lesson');
        assert(dbQ2.lesson_id === null && dbQ2.module_id === null && dbQ2.course_id === null, 'Quiz 2 unlinked from lesson');

        // ── Nested updates via Course Update API ──────────────────────────────
        console.log('\n--- Nested Updates via courseService.updateCourse ---');
        await courseService.updateCourse(course.id, {
            modules: [
                {
                    id: module1.id,
                    name: 'Module 1 - Updated',
                    order_num: 1,
                    assignment_ids: [a1.id],
                    quiz_ids: [q1.id],
                    lessons: [
                        {
                            id: lesson1.id,
                            name: 'Lesson 1 - Updated',
                            type: 'text',
                            order_num: 1,
                            assignment_ids: [a2.id],
                            quiz_ids: [q2.id]
                        }
                    ]
                }
            ]
        });

        dbA1 = await Assignment.findByPk(a1.id);
        dbQ1 = await Quiz.findByPk(q1.id);
        dbA2 = await Assignment.findByPk(a2.id);
        dbQ2 = await Quiz.findByPk(q2.id);
        assert(dbA1.module_id === module1.id && dbA1.lesson_id === null, 'Assignment 1 linked at module level nestedly');
        assert(dbQ1.module_id === module1.id && dbQ1.lesson_id === null, 'Quiz 1 linked at module level nestedly');
        assert(dbA2.lesson_id === lesson1.id, 'Assignment 2 linked at lesson level nestedly');
        assert(dbQ2.lesson_id === lesson1.id, 'Quiz 2 linked at lesson level nestedly');

        // Confirm hierarchy in response
        freshCourse = await courseService.getCourseById(course.id);
        assert(!('quizzes' in freshCourse), 'No quizzes at course root during nested update scenario');
        assert(!freshCourse.assignments.some(a => a.id === a1.id || a.id === a2.id),
            'Module/Lesson assignments do not bleed into course.assignments during nested update');

        // Unlink via empty arrays
        console.log('\n--- Nested Updates: Unlinking via empty arrays ---');
        await courseService.updateCourse(course.id, {
            modules: [
                {
                    id: module1.id,
                    name: 'Module 1 - Updated Again',
                    order_num: 1,
                    assignment_ids: [],
                    quiz_ids: [],
                    lessons: [
                        {
                            id: lesson1.id,
                            name: 'Lesson 1 - Updated Again',
                            type: 'text',
                            order_num: 1,
                            assignment_ids: [],
                            quiz_ids: []
                        }
                    ]
                }
            ]
        });

        dbA1 = await Assignment.findByPk(a1.id);
        dbQ1 = await Quiz.findByPk(q1.id);
        dbA2 = await Assignment.findByPk(a2.id);
        dbQ2 = await Quiz.findByPk(q2.id);
        assert(dbA1.module_id === null && dbA1.course_id === null, 'Assignment 1 unlinked from module nestedly (empty array)');
        assert(dbQ1.module_id === null && dbQ1.course_id === null, 'Quiz 1 unlinked from module nestedly (empty array)');
        assert(dbA2.lesson_id === null && dbA2.module_id === null && dbA2.course_id === null, 'Assignment 2 unlinked from lesson nestedly (empty array)');
        assert(dbQ2.lesson_id === null && dbQ2.module_id === null && dbQ2.course_id === null, 'Quiz 2 unlinked from lesson nestedly (empty array)');

        // Unlink via null
        console.log('\n--- Nested Updates: Unlinking via null ---');
        // Link back
        await courseService.updateCourse(course.id, {
            modules: [
                {
                    id: module1.id,
                    name: 'Module 1 - Updated',
                    order_num: 1,
                    assignment_ids: [a1.id],
                    quiz_ids: [q1.id],
                    lessons: [
                        {
                            id: lesson1.id,
                            name: 'Lesson 1 - Updated',
                            type: 'text',
                            order_num: 1,
                            assignment_ids: [a2.id],
                            quiz_ids: [q2.id]
                        }
                    ]
                }
            ]
        });

        // Unlink via null
        await courseService.updateCourse(course.id, {
            modules: [
                {
                    id: module1.id,
                    name: 'Module 1 - Updated',
                    order_num: 1,
                    assignment_ids: null,
                    quiz_ids: null,
                    lessons: [
                        {
                            id: lesson1.id,
                            name: 'Lesson 1 - Updated',
                            type: 'text',
                            order_num: 1,
                            assignment_ids: null,
                            quiz_ids: null
                        }
                    ]
                }
            ]
        });

        dbA1 = await Assignment.findByPk(a1.id);
        dbQ1 = await Quiz.findByPk(q1.id);
        dbA2 = await Assignment.findByPk(a2.id);
        dbQ2 = await Quiz.findByPk(q2.id);
        assert(dbA1.module_id === null && dbA1.course_id === null, 'Assignment 1 unlinked from module nestedly (null)');
        assert(dbQ1.module_id === null && dbQ1.course_id === null, 'Quiz 1 unlinked from module nestedly (null)');
        assert(dbA2.lesson_id === null && dbA2.module_id === null && dbA2.course_id === null, 'Assignment 2 unlinked from lesson nestedly (null)');
        assert(dbQ2.lesson_id === null && dbQ2.module_id === null && dbQ2.course_id === null, 'Quiz 2 unlinked from lesson nestedly (null)');

        // ── Partial update: Omitting assignment_ids/quiz_ids preserves links ───
        console.log('\n--- Partial update check ---');
        await courseService.updateCourse(course.id, {
            modules: [
                {
                    id: module1.id,
                    name: 'Module 1',
                    order_num: 1,
                    assignment_ids: [a1.id],
                    quiz_ids: [q1.id]
                }
            ]
        });
        dbA1 = await Assignment.findByPk(a1.id);
        dbQ1 = await Quiz.findByPk(q1.id);
        assert(dbA1.module_id === module1.id, 'Linked for partial update check');

        await courseService.updateCourse(course.id, {
            modules: [
                {
                    id: module1.id,
                    name: 'Module 1 Renamed',
                    order_num: 1
                }
            ]
        });
        dbA1 = await Assignment.findByPk(a1.id);
        dbQ1 = await Quiz.findByPk(q1.id);
        assert(dbA1.module_id === module1.id, 'Omitted assignment_ids preserves existing links');
        assert(dbQ1.module_id === module1.id, 'Omitted quiz_ids preserves existing links');

        // ── Cleanup ────────────────────────────────────────────────────────────
        console.log('\n--- Cleaning up test course hierarchy ---');
        await Course.destroy({ where: { id: course.id } });
        await a1.destroy();
        await a2.destroy();
        await a3.destroy();
        await q1.destroy();
        await q2.destroy();
        await q3.destroy();

        const finalAssignmentCount = await Assignment.count();
        const finalQuizCount = await Quiz.count();
        console.log(`Final DB State - Assignments: ${finalAssignmentCount}, Quizzes: ${finalQuizCount}`);
        assert(finalAssignmentCount === initialAssignmentCount, 'All test assignments cleaned up (no extra records deleted)');
        assert(finalQuizCount === initialQuizCount, 'All test quizzes cleaned up (no extra records deleted)');

        console.log('\n[SUCCESS] --- ALL PROGRAMMATIC VERIFICATION TESTS PASSED ---');
    } catch (err) {
        console.error('\n[FAIL] Verification failed:', err);
        process.exit(1);
    }
}

// Ensure database connection is closed after running
sequelize.authenticate()
    .then(() => verify())
    .finally(() => {
        sequelize.close();
    });
