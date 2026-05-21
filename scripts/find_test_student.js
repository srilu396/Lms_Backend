const { User, Student, Enrollment, Batch, Module, Topic, Lesson } = require('./src/models');
const { connectDB } = require('./src/db/connect');

async function test() {
    await connectDB();
    
    // Find all users who are students with an enrollment, excluding the previous ones
    const users = await User.findAll({ 
        where: { role: 'student' }
    });
    
    let found = false;
    
    for (const user of users) {
        if (user.email === 'testanil@gmail.com' || user.email === 'j.miller@site.org') continue;
        
        const student = await Student.findOne({ where: { email: user.email }});
        if (!student) continue;
        
        const enrollment = await Enrollment.findOne({ where: { student_id: student.id } });
        if (!enrollment) continue;

        const batch = await Batch.findByPk(enrollment.batch_id);
        if (!batch) continue;
        
        const module = await Module.findOne({ where: { course_id: batch.course_id } });
        if (!module) continue;

        const topic = await Topic.findOne({ where: { module_id: module.id } });
        if (!topic) continue;

        const lesson = await Lesson.findOne({ where: { topic_id: topic.id } });
        if (!lesson) continue;

        console.log(`NEW TEST STUDENT FOUND:`);
        console.log(` => Valid Login Email: ${user.email}`);
        console.log(` => Use Enrollment ID: ${enrollment.id}`);
        console.log(` => Use Lesson ID: ${lesson.id}`);
        console.log('-------------------------');
        found = true;
        break; // Just need one
    }
    
    if (!found) {
        console.log('No other students with active enrollments and lessons found in the database.');
    }
    process.exit(0);
}
test();
