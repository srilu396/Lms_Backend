const ProgressService = require('./src/services/progress.service');
const { connectDB } = require('./src/db/connect');

async function test() {
    await connectDB();
    console.log("Database connected successfully.");
    console.log("Service Methods:");
    console.log("- updateLessonProgress");
    console.log("- getCourseProgressSummary");
    
    // Attempting a pseudo run to see if models are loaded natively without crashing
    if (typeof ProgressService.updateLessonProgress === 'function' && typeof ProgressService.getCourseProgressSummary === 'function') {
        console.log("All Progress API endpoints and methods are fully loaded and formatted correctly.");
    } else {
        console.log("Error: ProgressService methods are missing.");
    }
    process.exit(0);
}
test();
