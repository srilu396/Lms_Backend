const { User, Student, Enrollment, Batch, Course, Module, Topic, Lesson } = require('./src/models');
const { connectDB } = require('./src/db/connect');

async function findTestData() {
  try {
    await connectDB();
    
    // Find an enrollment
    const enrollment = await Enrollment.findOne({
      include: [
        { model: Student, as: 'student' },
        { model: Batch, include: [{ model: Course }] }
      ]
    });
    
    if (!enrollment) {
      console.log('No enrollments found. You need to create an enrollment first.');
      process.exit(0);
    }
    
    // Check if there's a User for this student
    const user = await User.findOne({ where: { email: enrollment.student.email } });
    if (!user) {
      console.log('No user mapping for student email: ' + enrollment.student.email);
      process.exit(0);
    }
    
    const courseId = enrollment.Batch.course_id;
    
    // Get a lesson
    const module = await Module.findOne({ where: { course_id: courseId } });
    if (!module) {
      console.log('Course has no modules. course_id=' + courseId);
      process.exit(0);
    }
    
    const topic = await Topic.findOne({ where: { module_id: module.id } });
    if (!topic) {
        console.log('Module has no topics. module_id=' + module.id);
        process.exit(0);
    }
    
    const lesson = await Lesson.findOne({ where: { topic_id: topic.id } });
    if (!lesson) {
        console.log('Topic has no lessons. topic_id=' + topic.id);
        process.exit(0);
    }
    
    console.log('=== TEST DATA FOUND ===');
    console.log('Login Email:', user.email);
    console.log('Enrollment ID:', enrollment.id);
    console.log('Lesson ID:', lesson.id);
    console.log('Course ID:', courseId);
    console.log('Module ID:', module.id);
    
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}
findTestData();
