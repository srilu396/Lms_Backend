const { User, Student, Enrollment, Batch, Module, Topic, Lesson } = require('./src/models');
const { connectDB } = require('./src/db/connect');

async function test() {
    await connectDB();
    for (const email of ['testanil@gmail.com', 'j.miller@site.org']) {
        const student = await Student.findOne({ where: { email }});
        if (!student) continue;
        
        const enrollment = await Enrollment.findOne({ where: { student_id: student.id } });
        if (!enrollment) continue;

        const batch = await Batch.findByPk(enrollment.batch_id);
        const module = await Module.findOne({ where: { course_id: batch.course_id } });
        if (!module) continue;

        const topic = await Topic.findOne({ where: { module_id: module.id } });
        if (!topic) continue;

        const lesson = await Lesson.findOne({ where: { topic_id: topic.id } });
        if (!lesson) continue;

        console.log(`For User logged in as ${email}:`);
        console.log(` => Use Enrollment ID: ${enrollment.id}`);
        console.log(` => Use Lesson ID: ${lesson.id}`);
        console.log('-------------------------');
    }
    process.exit(0);
}
test();
