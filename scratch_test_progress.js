require('dotenv').config();
const { User, Student, Enrollment, Batch, Course, Module, StudentProgress } = require('./src/models');
const jwt = require('jsonwebtoken');
const axios = require('axios');

async function testProgress() {
    try {
        console.log("Looking for user anil@gmail.com...");
        const user = await User.findOne({ where: { email: 'anil@gmail.com' } });
        if (!user) return console.log("User not found");
        
        const enrollment = await Enrollment.findOne({
            where: { id: 160 },
            include: [{
                model: Batch,
                include: [{ model: Course, include: [{ model: Module, as: 'modules' }] }]
            }]
        });
        
        if (!enrollment) return console.log("Enrollment not found");
        
        const course = enrollment.Batch.Course;
        const targetModule = course.modules[0]; // Take the first module of Course 10
        
        console.log(`Testing Module Completion...`);
        console.log(`Course: ${course.name}, Target Module ID: ${targetModule.id}`);
        
        const progressService = require('./src/services/progress.service');
        
        console.log("1. Calling progressService.updateModuleProgress...");
        await progressService.updateModuleProgress(user.id, enrollment.id, targetModule.id, { is_completed: true });
        
        console.log("2. Verifying DB...");
        const progress = await StudentProgress.findOne({
            where: {
                student_id: user.id,
                enrollment_id: enrollment.id,
                module_id: targetModule.id
            }
        });
        
        if (progress) {
            console.log(`SUCCESS! Progress record found: is_completed=${progress.is_completed}, pct=${progress.progress_pct}`);
        } else {
            console.log("FAILURE! Progress record NOT found in DB.");
        }
        
    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        process.exit();
    }
}

testProgress();
