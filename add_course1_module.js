const { connectDB } = require('./src/db/connect');
const { Module, Topic, Lesson } = require('./src/models');

async function test() {
    await connectDB();
    console.log('Creating a dummy module, topic, and lesson for Course 1...');
    const mod = await Module.create({ course_id: 1, name: 'Intro Module', description: 'Testing Module', order_num: 1, is_locked: false });
    const top = await Topic.create({ module_id: mod.id, name: 'Intro Topic', order_num: 1 });
    const les = await Lesson.create({ topic_id: top.id, name: 'Intro Lesson', type: 'text', order_num: 1 });
    
    console.log(`NEW DUMMY LESSON CREATED FOR COURSE 1!`);
    console.log(`Lesson ID to test: ${les.id}`);
    process.exit(0);
}
test();
