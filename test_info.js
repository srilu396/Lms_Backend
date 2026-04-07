const { User, Student, Enrollment } = require('./src/models');
const { connectDB } = require('./src/db/connect');

async function test() {
    await connectDB();
    const enrollment = await Enrollment.findByPk(138, {
        include: [{ model: Student, as: 'student' }]
    });
    if (!enrollment) {
        console.log('Enrollment 138 DOES NOT EXIST.');
    } else {
        console.log('Enrollment 138 Student Email:', enrollment.student ? enrollment.student.email : 'NO STUDENT');
    }
    
    // Find ANY enrollment to give them
    const anyEnrollment = await Enrollment.findOne({
        include: [{ model: Student, as: 'student' }]
    });
    if (anyEnrollment && anyEnrollment.student) {
        console.log('Try this enrollment ID instead:', anyEnrollment.id);
        console.log('It belongs to student email:', anyEnrollment.student.email);
    }
    process.exit(0);
}
test();
