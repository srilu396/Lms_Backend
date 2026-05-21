const { User, Student, Enrollment, Batch, Module, Topic, Lesson } = require('./src/models');
const { connectDB } = require('./src/db/connect');

async function test() {
    await connectDB();
    const email = 'anil@gmail.com';
    
    console.log(`Searching for data for ${email}...`);
    
    try {
        const student = await Student.findOne({ where: { email }});
        if (!student) {
            console.log(`No student found with email ${email}`);
            process.exit(0);
        }
        
        const enrollment = await Enrollment.findOne({ where: { student_id: student.id } });
        if (!enrollment) {
            console.log(`Student ${email} has no enrollments.`);
            process.exit(0);
        }

        const batch = await Batch.findByPk(enrollment.batch_id);
        if (!batch) {
            console.log(`Enrollment ${enrollment.id} is connected to a non-existent batch.`);
            process.exit(0);
        }
        
        const module = await Module.findOne({ where: { course_id: batch.course_id } });
        if (!module) {
            console.log(`Batch is connected to course ${batch.course_id} which has no modules.`);
            process.exit(0);
        }

        const topic = await Topic.findOne({ where: { module_id: module.id } });
        if (!topic) {
            console.log(`Module ${module.id} has no topics.`);
            process.exit(0);
        }

        const lesson = await Lesson.findOne({ where: { topic_id: topic.id } });
        if (!lesson) {
            console.log(`Topic ${topic.id} has no lessons.`);
            process.exit(0);
        }

        console.log(`SUCCESS! Here are the details for ${email}:`);
        console.log(` => Enrollment ID: ${enrollment.id}`);
        console.log(` => Lesson ID: ${lesson.id}`);
    } catch (err) {
        console.log('Error:', err);
    }
    process.exit(0);
}
test();
