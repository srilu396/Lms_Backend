require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { User, Assignment, Quiz, Course, sequelize } = require('../src/models');

async function run() {
    console.log("=========================================");
    console.log("   COURSE API VERIFICATION SUITE         ");
    console.log("=========================================\n");

    const results = [];
    let testCourseId = null;
    let dummyAssignmentIds = [];
    let dummyQuizIds = [];

    // Helper to log test results
    function logResult(apiName, passed, expected, actual, reason = "") {
        results.push({
            API: apiName,
            Status: passed ? "PASS" : "FAIL",
            Expected: expected,
            Actual: actual,
            Reason: reason
        });
        console.log(`[${passed ? "PASS" : "FAIL"}] ${apiName} ${reason ? `- ${reason}` : ""}`);
    }

    try {
        // 1. Initialize and get Admin Token
        const adminUser = await User.findOne({ where: { role: 'admin' } });
        if (!adminUser) {
            logResult("Init Admin Token", false, "An admin user exists", "None found", "No admin user found in database");
            process.exit(1);
        }

        const token = jwt.sign(
            { userId: adminUser.id, email: adminUser.email, role: adminUser.role },
            process.env.JWT_ACCESS_SECRET || 'fallback_access_secret',
            { expiresIn: '1h' }
        );

        const port = process.env.PORT || 5001;
        const api = axios.create({
            baseURL: `http://localhost:${port}/api/v1`,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            validateStatus: () => true // Allow handling non-200 responses
        });

        console.log(`Using base URL: http://localhost:${port}/api/v1`);
        console.log(`Authenticated as admin: ${adminUser.email}\n`);

        // 2. Fetch/Create dummy assignments and quizzes for testing associations
        let assignments = await Assignment.findAll({ limit: 3 });
        if (assignments.length < 3) {
            // Create some dummy assignments
            for (let i = 1; i <= 3; i++) {
                const ass = await Assignment.create({
                    title: `Test Assignment ${i} ${Date.now()}`,
                    submission_type: 'text',
                    max_score: 100.0,
                    status: 'active'
                });
                assignments.push(ass);
            }
        }
        dummyAssignmentIds = assignments.map(a => a.id);

        let quizzes = await Quiz.findAll({ limit: 3 });
        if (quizzes.length < 3) {
            // Create some dummy quizzes
            for (let i = 1; i <= 3; i++) {
                const q = await Quiz.create({
                    name: `Test Quiz ${i} ${Date.now()}`,
                    status: 'active'
                });
                quizzes.push(q);
            }
        }
        dummyQuizIds = quizzes.map(q => q.id);

        console.log(`Test Assignments: ${JSON.stringify(dummyAssignmentIds)}`);
        console.log(`Test Quizzes: ${JSON.stringify(dummyQuizIds)}\n`);

        // --- TEST 1: GET /courses ---
        const getCoursesRes = await api.get('/courses?page=1&limit=5');
        if (getCoursesRes.status === 200 && getCoursesRes.data.success) {
            logResult("GET /courses", true, "200 Success", `${getCoursesRes.status} success=${getCoursesRes.data.success}`);
        } else {
            logResult("GET /courses", false, "200 Success", `${getCoursesRes.status}`, JSON.stringify(getCoursesRes.data));
        }

        // --- TEST 2: GET /courses/stats ---
        const getStatsRes = await api.get('/courses/stats');
        if (getStatsRes.status === 200 && getStatsRes.data.success) {
            logResult("GET /courses/stats", true, "200 Success", `${getStatsRes.status} success=${getStatsRes.data.success}`);
        } else {
            logResult("GET /courses/stats", false, "200 Success", `${getStatsRes.status}`, JSON.stringify(getStatsRes.data));
        }

        // --- TEST 3: GET /courses/lookup ---
        const getLookupRes = await api.get('/courses/lookup');
        if (getLookupRes.status === 200 && getLookupRes.data.success) {
            logResult("GET /courses/lookup", true, "200 Success", `${getLookupRes.status} success=${getLookupRes.data.success}`);
        } else {
            logResult("GET /courses/lookup", false, "200 Success", `${getLookupRes.status}`, JSON.stringify(getLookupRes.data));
        }

        // --- TEST 4: POST /courses (Create Course with assignment_ids & modules/lessons/topics) ---
        const newCoursePayload = {
            name: `Verify API Course ${Date.now()}`,
            description: "A course created by verification script",
            thumbnail_url: "https://example.com/logo.png",
            status: "draft",
            assignment_ids: [dummyAssignmentIds[0]], // Link assignment 1 to Course
            modules: [
                {
                    name: "Module 1",
                    order_num: 1,
                    assignment_ids: [dummyAssignmentIds[1]], // Link assignment 2 to Module
                    quizzes: [dummyQuizIds[0]],             // Link quiz 1 to Module
                    lessons: [
                        {
                            name: "Lesson 1.1",
                            type: "text",
                            order_num: 1,
                            assignment_ids: [dummyAssignmentIds[2]], // Link assignment 3 to Lesson
                            quizzes: [dummyQuizIds[1]],             // Link quiz 2 to Lesson
                            topics: [
                                {
                                    name: "Topic 1.1.1",
                                    order_num: 1,
                                    assignment_ids: [],
                                    quizzes: [dummyQuizIds[2]]       // Link quiz 3 to Topic
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        const postCourseRes = await api.post('/courses', newCoursePayload);
        if (postCourseRes.status === 201 && postCourseRes.data.success) {
            testCourseId = postCourseRes.data.data.id;
            logResult("POST /courses", true, "201 Created", `${postCourseRes.status} ID=${testCourseId}`);
        } else {
            logResult("POST /courses", false, "201 Created", `${postCourseRes.status}`, JSON.stringify(postCourseRes.data));
        }

        if (testCourseId) {
            // --- TEST 4b: POST /courses/:courseId/modules ---
            let testModuleId = null;
            const postModuleRes = await api.post(`/courses/${testCourseId}/modules`, {
                name: "Part-wise Module 2",
                order_num: 2,
                assignment_ids: [],
                quizzes: []
            });
            if (postModuleRes.status === 201 && postModuleRes.data.success) {
                testModuleId = postModuleRes.data.data.id;
                logResult("POST /courses/:courseId/modules", true, "201 Created", `${postModuleRes.status} ID=${testModuleId}`);
            } else {
                logResult("POST /courses/:courseId/modules", false, "201 Created", `${postModuleRes.status}`, JSON.stringify(postModuleRes.data));
            }

            // --- TEST 4c: POST /modules/:moduleId/lessons ---
            let testLessonId = null;
            if (testModuleId) {
                const postLessonRes = await api.post(`/modules/${testModuleId}/lessons`, {
                    name: "Part-wise Lesson 2.1",
                    type: "text",
                    order_num: 1,
                    assignment_ids: [],
                    quizzes: []
                });
                if (postLessonRes.status === 201 && postLessonRes.data.success) {
                    testLessonId = postLessonRes.data.data.id;
                    logResult("POST /modules/:moduleId/lessons", true, "201 Created", `${postLessonRes.status} ID=${testLessonId}`);
                } else {
                    logResult("POST /modules/:moduleId/lessons", false, "201 Created", `${postLessonRes.status}`, JSON.stringify(postLessonRes.data));
                }
            }

            // --- TEST 4d: POST /lessons/:lessonId/topics ---
            if (testLessonId) {
                const postTopicRes = await api.post(`/lessons/${testLessonId}/topics`, {
                    name: "Part-wise Topic 2.1.1",
                    order_num: 1,
                    assignment_ids: [],
                    quizzes: []
                });
                if (postTopicRes.status === 201 && postTopicRes.data.success) {
                    const testTopicId = postTopicRes.data.data.id;
                    logResult("POST /lessons/:lessonId/topics", true, "201 Created", `${postTopicRes.status} ID=${testTopicId}`);
                } else {
                    logResult("POST /lessons/:lessonId/topics", false, "201 Created", `${postTopicRes.status}`, JSON.stringify(postTopicRes.data));
                }
            }

            // --- TEST 5: GET /courses/:id (Verify Associations were properly created & linked) ---
            const getCourseRes = await api.get(`/courses/${testCourseId}`);
            if (getCourseRes.status === 200 && getCourseRes.data.success) {
                const c = getCourseRes.data.data;
                const matchesCourseAss = c.assignments && c.assignments.some(a => a.id === dummyAssignmentIds[0]);
                const matchesModuleAss = c.modules && c.modules[0] && c.modules[0].assignments.some(a => a.id === dummyAssignmentIds[1]);
                const matchesModuleQuiz = c.modules && c.modules[0] && c.modules[0].quizzes.some(q => q.id === dummyQuizIds[0]);
                
                const passed = matchesCourseAss && matchesModuleAss && matchesModuleQuiz;
                logResult("GET /courses/:id", passed, "Linked course/module/lesson assessments", 
                    `CourseAssMatch=${matchesCourseAss}, ModAssMatch=${matchesModuleAss}, ModQuizMatch=${matchesModuleQuiz}`);
            } else {
                logResult("GET /courses/:id", false, "200 Success", `${getCourseRes.status}`, JSON.stringify(getCourseRes.data));
            }

            // --- TEST 6: PUT /courses/:id (Update entire curriculum with assignment_ids & modules) ---
            const updatedPayload = {
                name: `Updated Verify API Course ${Date.now()}`,
                status: "published", // Should map to "active"
                assignment_ids: [], // Unlink course level assignment
                modules: [
                    {
                        id: getCourseRes.data.data.modules[0].id, // Keep existing module
                        name: "Module 1 (Updated)",
                        order_num: 1,
                        assignment_ids: [dummyAssignmentIds[0]], // Swap assignment to module level
                        quizzes: [dummyQuizIds[1]],             // Swap quiz
                        lessons: [
                            {
                                id: getCourseRes.data.data.modules[0].lessons[0].id,
                                name: "Lesson 1.1 (Updated)",
                                type: "video",
                                video_url: "https://example.com/video.mp4",
                                order_num: 1,
                                assignment_ids: [], // Unlink lesson assignment
                                quizzes: [],
                                topics: [] // Delete topics
                            }
                        ]
                    }
                ]
            };

            const putCourseRes = await api.put(`/courses/${testCourseId}`, updatedPayload);
            if (putCourseRes.status === 200 && putCourseRes.data.success) {
                const updatedCourse = putCourseRes.data.data;
                const isStatusActive = updatedCourse.status === 'active';
                const courseLevelAss = updatedCourse.assignments.filter(a => !a.module_id && !a.lesson_id && !a.topic_id);
                const isCourseAssUnlinked = courseLevelAss.length === 0;
                const isModAssLinked = updatedCourse.modules[0].assignments.some(a => a.id === dummyAssignmentIds[0]);
                
                const passed = isStatusActive && isCourseAssUnlinked && isModAssLinked;
                logResult("PUT /courses/:id", passed, "Transactional course update success", 
                    `status=${updatedCourse.status}, courseLevelAssLength=${courseLevelAss.length}, modAssMatch=${isModAssLinked}`);
            } else {
                logResult("PUT /courses/:id", false, "200 Success", `${putCourseRes.status}`, JSON.stringify(putCourseRes.data));
            }

            // --- TEST 7: GET /courses/:id/curriculum ---
            const getCurriculumRes = await api.get(`/courses/${testCourseId}/curriculum`);
            if (getCurriculumRes.status === 200 && getCurriculumRes.data.success) {
                logResult("GET /courses/:id/curriculum", true, "200 Success", `${getCurriculumRes.status} success=${getCurriculumRes.data.success}`);
            } else {
                logResult("GET /courses/:id/curriculum", false, "200 Success", `${getCurriculumRes.status}`, JSON.stringify(getCurriculumRes.data));
            }

            // --- TEST 8: DELETE /courses/:id ---
            const deleteCourseRes = await api.delete(`/courses/${testCourseId}`);
            if (deleteCourseRes.status === 200 && deleteCourseRes.data.success) {
                logResult("DELETE /courses/:id", true, "200 Success", `${deleteCourseRes.status} success=${deleteCourseRes.data.success}`);
            } else {
                logResult("DELETE /courses/:id", false, "200 Success", `${deleteCourseRes.status}`, JSON.stringify(deleteCourseRes.data));
            }
        }

    } catch (error) {
        console.error("Test execution aborted with error:", error);
    } finally {
        await sequelize.close();
        console.log("\n=========================================");
        console.log("   VERIFICATION REPORT                   ");
        console.log("=========================================");
        console.table(results);
    }
}

run();
