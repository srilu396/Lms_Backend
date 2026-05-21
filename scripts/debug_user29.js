const { sequelize } = require('./src/db/connect');
const { Student, Enrollment, Batch, Assignment } = require('./src/models');
async function run() {
    await sequelize.authenticate();
    const student = await Student.findOne({ where: { user_id: 29 } });
    if (!student) {
        console.log("No student record found with user_id 29");
    } else {
        console.log("Student ID:", student.id);
        const enrollments = await Enrollment.findAll({
            where: { student_id: student.id, status: 'active' },
            include: [{ model: Batch, required: true, attributes: ['course_id'] }]
        });
        console.log("Enrollments:", enrollments.map(e => e.toJSON()));
        const courseIds = [...new Set(enrollments.map(e => e.Batch.course_id))];
        console.log("Course IDs:", courseIds);
        const assignments = await Assignment.count({ where: { course_id: courseIds, status: 'active' } });
        console.log("Assignments for courses:", assignments);
    }
    process.exit();
}
run();
