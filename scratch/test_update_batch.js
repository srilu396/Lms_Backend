const { Batch, Enrollment, Student, sequelize } = require('../src/models');
const batchService = require('../src/services/batch.service');

async function testUpdateBatch() {
    try {
        console.log('--- Testing updateBatch Syncing ---');
        
        // 1. Find a batch with some enrollments
        const enrollment = await Enrollment.findOne();
        if (!enrollment) {
            console.log('No enrollments found to test with.');
            return;
        }
        
        const batchId = enrollment.batch_id;
        console.log(`Testing with Batch ID: ${batchId}`);

        // Get current students
        let currentEnrollments = await Enrollment.findAll({ where: { batch_id: batchId } });
        let currentStudentIds = currentEnrollments.map(e => e.student_id);
        console.log('Current Student IDs:', currentStudentIds);

        // 2. Prepare new student list
        // Remove the first student, and add a completely different active student (if one exists)
        const studentToRemove = currentStudentIds[0];
        
        const newStudent = await Student.findOne({ 
            where: { 
                status: 'active',
                id: { [require('sequelize').Op.notIn]: currentStudentIds } 
            } 
        });

        const newStudentIdsList = currentStudentIds.filter(id => id !== studentToRemove);
        if (newStudent) {
            newStudentIdsList.push(newStudent.id);
            console.log(`Adding Student ID: ${newStudent.id}`);
        } else {
            console.log('No new student available to add, just removing one.');
        }
        console.log(`Removing Student ID: ${studentToRemove}`);
        console.log('New desired list of Student IDs:', newStudentIdsList);

        // 3. Call updateBatch
        await batchService.updateBatch(batchId, { enroll_students: newStudentIdsList });
        
        console.log('updateBatch executed successfully.');

        // 4. Verify results
        const updatedEnrollments = await Enrollment.findAll({ where: { batch_id: batchId } });
        const updatedStudentIds = updatedEnrollments.map(e => e.student_id);
        
        console.log('Updated Student IDs in DB:', updatedStudentIds);
        
        // Assertions
        if (!updatedStudentIds.includes(studentToRemove)) {
            console.log('SUCCESS: The removed student is NO LONGER in the batch.');
        } else {
            console.error('FAIL: The removed student is STILL in the batch.');
        }

        if (newStudent) {
            if (updatedStudentIds.includes(newStudent.id)) {
                console.log('SUCCESS: The new student was SUCCESSFULLY added to the batch.');
            } else {
                console.error('FAIL: The new student was NOT added to the batch.');
            }
        }

    } catch (e) {
        console.error('Test failed with error:', e);
    } finally {
        await sequelize.close();
        process.exit(0);
    }
}

testUpdateBatch();
