const { Student, Enrollment, Batch, Course } = require('./src/models');
const { connectDB } = require('./src/db/connect');

async function enrollStudent() {
    try {
        await connectDB();
        
        const studentEmail = 'anil@gmail.com';
        const student = await Student.findOne({ where: { email: studentEmail } });
        
        if (!student) {
            console.log("Student not found!");
            return;
        }

        console.log(`Enrolling student ID ${student.id} (${studentEmail})...`);

        // Target course IDs
        const targetCourseIds = [10];
        
        // Find 4 other courses (excluding 10)
        const otherCourses = await Course.findAll({
            where: { status: 'active' },
            limit: 10 // Get some to choose from
        });
        
        for (const c of otherCourses) {
            if (c.id !== 10 && targetCourseIds.length < 5) {
                targetCourseIds.push(c.id);
            }
        }

        console.log("Target Course IDs:", targetCourseIds);

        for (const courseId of targetCourseIds) {
            // Find a batch for this course
            const batch = await Batch.findOne({ where: { course_id: courseId, status: 'active' } });
            
            if (!batch) {
                console.log(`No active batch found for Course ID ${courseId}. Skipping...`);
                continue;
            }

            // Check if already enrolled
            const existing = await Enrollment.findOne({
                where: { student_id: student.id, batch_id: batch.id }
            });

            if (existing) {
                console.log(`Already enrolled in Course ID ${courseId} (Batch ID ${batch.id}).`);
                continue;
            }

            // Create enrollment
            await Enrollment.create({
                student_id: student.id,
                batch_id: batch.id,
                status: 'active',
                enrollment_date: new Date()
            });

            console.log(`Successfully enrolled in Course: ${courseId} (Batch: ${batch.id})`);
        }

        process.exit(0);
    } catch (error) {
        console.error("Error during enrollment:", error);
        process.exit(1);
    }
}

enrollStudent();
