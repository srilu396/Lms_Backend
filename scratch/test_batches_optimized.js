const { connectDB, sequelize } = require('../src/db/connect');
const { 
    Batch, 
    Course, 
    User, 
    Enrollment, 
    LessonProgress, 
    AssignmentSubmission, 
    QuizSubmission,
    Assignment
} = require('../src/models');
const { Op } = require('sequelize');

async function getBatchTotalItemsInCourses(courseIds) {
    if (!courseIds.length) return {};
    
    try {
        const [lessonsResults, quizzesResults, assignmentsCounts] = await Promise.all([
            sequelize.query(`
                SELECT m.course_id, COUNT(DISTINCT l.id) as count 
                FROM lessons l
                JOIN topics t ON l.topic_id = t.id
                JOIN modules m ON t.module_id = m.id
                WHERE m.course_id IN (:courseIds)
                GROUP BY m.course_id
            `, { replacements: { courseIds }, type: sequelize.QueryTypes.SELECT }),
            
            sequelize.query(`
                SELECT m.course_id, COUNT(DISTINCT q.id) as count 
                FROM quizzes q
                JOIN topics t ON q.topic_id = t.id
                JOIN modules m ON t.module_id = m.id
                WHERE m.course_id IN (:courseIds)
                GROUP BY m.course_id
            `, { replacements: { courseIds }, type: sequelize.QueryTypes.SELECT }),
            
            Assignment.findAll({
                attributes: ['course_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                where: { course_id: { [Op.in]: courseIds } },
                group: ['course_id'],
                raw: true
            })
        ]);

        const courseItemsMap = {};
        
        courseIds.forEach(cid => {
            courseItemsMap[cid] = 0;
        });

        lessonsResults.forEach(r => {
            courseItemsMap[r.course_id] = (courseItemsMap[r.course_id] || 0) + parseInt(r.count || 0, 10);
        });

        quizzesResults.forEach(r => {
            courseItemsMap[r.course_id] = (courseItemsMap[r.course_id] || 0) + parseInt(r.count || 0, 10);
        });

        assignmentsCounts.forEach(r => {
            courseItemsMap[r.course_id] = (courseItemsMap[r.course_id] || 0) + parseInt(r.count || 0, 10);
        });

        return courseItemsMap;
    } catch (error) {
        console.error("Error in getBatchTotalItemsInCourses:", error);
        return {};
    }
}

async function getBatchesOptimized(query, institutionId) {
    const page = parseInt(query.page || query.Page || 1);
    const limit = parseInt(query.limit || query.Limit || 10);
    const search = query.search || query.Search || '';
    const department = query.department || query.Filter || null;

    const offset = (page - 1) * limit;

    const whereBatch = { institution_id: institutionId };
    
    if (department) {
        whereBatch.department = { [Op.iLike]: `%${department}%` };
    }

    if (search) {
        whereBatch[Op.or] = [
            { name: { [Op.iLike]: `%${search}%` } },
            { '$tutors.full_name$': { [Op.iLike]: `%${search}%` } }
        ];
    }

    const { rows: batches, count } = await Batch.findAndCountAll({
        where: whereBatch,
        include: [
            { 
                model: Course,
                attributes: ['id', 'name']
            },
            { model: User, as: 'tutors', attributes: ['id', 'full_name'] }
        ],
        limit,
        offset,
        order: [['created_at', 'DESC']],
        distinct: true,
        subQuery: false
    });

    const courseIds = [...new Set(batches.map(b => b.course_id))];
    const batchIds = batches.map(b => b.id);

    if (batchIds.length === 0) {
        return {
            batches: [],
            pagination: { page, limit, total: count, totalPages: Math.ceil(count / limit) }
        };
    }

    const [enrollments, courseItemsMap] = await Promise.all([
        Enrollment.findAll({
            where: { batch_id: { [Op.in]: batchIds } },
            attributes: ['id', 'student_id', 'batch_id'],
            raw: true
        }),
        getBatchTotalItemsInCourses(courseIds)
    ]);

    const enrollmentsByBatch = {};
    enrollments.forEach(e => {
        if (!enrollmentsByBatch[e.batch_id]) {
            enrollmentsByBatch[e.batch_id] = [];
        }
        enrollmentsByBatch[e.batch_id].push(e);
    });

    const enrollmentIds = enrollments.map(e => e.id);
    
    let completionsMap = {};
    if (enrollmentIds.length > 0) {
        const [lessonsCounts, assignmentsCounts, quizzesCounts] = await Promise.all([
            LessonProgress.findAll({
                attributes: ['enrollment_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                where: { enrollment_id: { [Op.in]: enrollmentIds }, is_completed: true },
                group: ['enrollment_id'],
                raw: true
            }),
            AssignmentSubmission.findAll({
                attributes: ['enrollment_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                where: { enrollment_id: { [Op.in]: enrollmentIds }, status: { [Op.in]: ['submitted', 'graded'] } },
                group: ['enrollment_id'],
                raw: true
            }),
            QuizSubmission.findAll({
                attributes: ['enrollment_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                where: { enrollment_id: { [Op.in]: enrollmentIds }, status: { [Op.in]: ['completed', 'reviewed'] } },
                group: ['enrollment_id'],
                raw: true
            })
        ]);

        lessonsCounts.forEach(c => {
            completionsMap[c.enrollment_id] = (completionsMap[c.enrollment_id] || 0) + (parseInt(c.count) || 0);
        });
        assignmentsCounts.forEach(c => {
            completionsMap[c.enrollment_id] = (completionsMap[c.enrollment_id] || 0) + (parseInt(c.count) || 0);
        });
        quizzesCounts.forEach(c => {
            completionsMap[c.enrollment_id] = (completionsMap[c.enrollment_id] || 0) + (parseInt(c.count) || 0);
        });
    }

    const formattedBatches = [];
    for (const batch of batches) {
        const batchEnrollments = enrollmentsByBatch[batch.id] || [];
        const studentIds = batchEnrollments.map(e => e.student_id);
        
        let progressPercentage = 0;
        let progressStatus = 'upcoming';

        if (studentIds.length > 0) {
            const totalItemsInCourse = courseItemsMap[batch.course_id] || 0;
            if (totalItemsInCourse > 0) {
                let totalCompletions = 0;
                batchEnrollments.forEach(e => {
                    totalCompletions += completionsMap[e.id] || 0;
                });

                const maxPossibleCompletions = totalItemsInCourse * studentIds.length;
                progressPercentage = Math.round((totalCompletions / maxPossibleCompletions) * 100);

                if (progressPercentage === 100) {
                    progressStatus = 'completed';
                } else {
                    const today = new Date();
                    const start = new Date(batch.start_date);
                    const end = new Date(batch.end_date);
                    
                    if (today < start) {
                        progressStatus = 'upcoming';
                    } else if (today > end) {
                        progressStatus = 'at_risk';
                    } else {
                        const totalDuration = end - start;
                        const elapsed = today - start;
                        const expectedProgress = (elapsed / totalDuration) * 100;

                        if (progressPercentage < expectedProgress - 10 || progressPercentage < 60) {
                            progressStatus = 'at_risk';
                        } else {
                            progressStatus = 'on_track';
                        }
                    }
                }
            } else {
                progressStatus = 'on_track';
            }
        }

        formattedBatches.push({
            id: batch.id,
            batch_id: `#BATCH-${batch.id}`,
            batch_name: batch.name,
            tutor: (batch.tutors && batch.tutors.length > 0) ? batch.tutors.map(t => t.full_name).join(', ') : 'Unassigned',
            course: batch.Course?.name || 'N/A',
            department: batch.department || 'Design',
            start_date: batch.start_date,
            status: batch.status,
            total_students: studentIds.length,
            progress_percentage: progressPercentage,
            progress_status: progressStatus
        });
    }

    return {
        batches: formattedBatches,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: count,
            totalPages: Math.ceil(count / limit)
        }
    };
}

async function verify() {
    await connectDB();
    console.log("Connected to DB.");

    const institutionId = 9;

    console.log("\n--- Old Service ---");
    const oldService = require('../src/services/institutionRep/batches.service');
    console.time("old_getBatches");
    const oldResult = await oldService.getBatches({ Page: 1, Limit: 10 }, institutionId);
    console.timeEnd("old_getBatches");

    console.log("\n--- Optimized Service ---");
    console.time("opt_getBatches");
    const optResult = await getBatchesOptimized({ Page: 1, Limit: 10 }, institutionId);
    console.timeEnd("opt_getBatches");

    console.log("\nChecking batches counts...");
    console.log("old count:", oldResult.batches.length, "opt count:", optResult.batches.length);

    console.log("\nChecking batches equality...");
    // Let's only compare fields that both have (opt doesn't populate institution_name since it is not requested by the user, but we can compare others)
    const oldClean = oldResult.batches.map(b => ({
        id: b.id,
        batch_name: b.batch_name,
        tutor: b.tutor,
        course: b.course,
        total_students: b.total_students,
        progress_percentage: b.progress_percentage
    }));
    const optClean = optResult.batches.map(b => ({
        id: b.id,
        batch_name: b.batch_name,
        tutor: b.tutor,
        course: b.course,
        total_students: b.total_students,
        progress_percentage: b.progress_percentage
    }));

    console.log("Cleaned batches equal:", JSON.stringify(oldClean) === JSON.stringify(optClean));
    if (JSON.stringify(oldClean) !== JSON.stringify(optClean)) {
        console.log("OLD clean:", JSON.stringify(oldClean, null, 2));
        console.log("OPT clean:", JSON.stringify(optClean, null, 2));
    }

    process.exit(0);
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
