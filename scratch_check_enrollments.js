require('dotenv').config();
const { User, Student, Enrollment, Batch, Course, Module, StudentProgress } = require('./src/models');

async function checkEnrollments() {
    try {
        const student = await Student.findOne({ where: { email: 'anil@gmail.com' } });
        console.log(`Student ID: ${student.id}`);
        
        const enrollments = await Enrollment.findAll({
            where: { student_id: student.id },
            include: [{
                model: Batch,
                include: [{ model: Course, include: [{ model: Module, as: 'modules' }] }]
            }]
        });
        
        for (const enr of enrollments) {
            console.log(`Enrollment ID: ${enr.id}, Status: ${enr.status}, Batch ID: ${enr.batch_id}`);
            if (enr.Batch) {
                console.log(`  Batch: ${enr.Batch.name}, Course ID: ${enr.Batch.course_id}`);
                if (enr.Batch.Course) {
                    console.log(`  Course: ${enr.Batch.Course.name}, Modules Count: ${enr.Batch.Course.modules.length}`);
                }
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        process.exit();
    }
}
checkEnrollments();
