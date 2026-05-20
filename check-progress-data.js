const { 
    Batch, 
    Course, 
    Enrollment, 
    Assignment, 
    Quiz, 
    Module, 
    Topic, 
    Lesson, 
    LessonProgress,
    AssignmentSubmission,
    QuizSubmission,
    sequelize 
} = require('./src/models');

async function checkData() {
    try {
        const batch = await Batch.findOne({ where: { id: 11 } }); // We know Batch 11 exists from the previous run
        console.log("Batch ID:", batch.id, "Course ID:", batch.course_id);

        const courseId = batch.course_id;

        const assignments = await Assignment.count({ where: { course_id: courseId } });
        console.log("Assignments in course:", assignments);

        const modules = await Module.count({ where: { course_id: courseId } });
        console.log("Modules in course:", modules);

        const topics = await Topic.count({
            include: [{ model: Module, where: { course_id: courseId } }]
        });
        console.log("Topics in course:", topics);

        const lessons = await Lesson.count({
            include: [{ 
                model: Topic,
                include: [{ model: Module, where: { course_id: courseId } }]
            }]
        });
        console.log("Lessons in course:", lessons);

        const enrollments = await Enrollment.findAll({ where: { batch_id: batch.id } });
        const studentIds = enrollments.map(e => e.student_id);

        console.log("Student IDs in batch:", studentIds.length);

        let completedAssignments = 0;
        let completedQuizzes = 0;
        let completedLessons = 0;

        for (const e of enrollments) {
            completedAssignments += await AssignmentSubmission.count({ 
                where: { student_id: e.student_id, enrollment_id: e.id, status: ['submitted', 'graded'] } 
            });
            completedQuizzes += await QuizSubmission.count({ 
                where: { student_id: e.student_id, enrollment_id: e.id, status: ['completed', 'reviewed'] } 
            });
            completedLessons += await LessonProgress.count({ 
                where: { student_id: e.student_id, enrollment_id: e.id, is_completed: true } 
            });
        }

        console.log("Completed Assignments:", completedAssignments);
        console.log("Completed Quizzes:", completedQuizzes);
        console.log("Completed Lessons:", completedLessons);

    } catch (error) {
        console.error(error);
    } finally {
        await sequelize.close();
    }
}

checkData();
