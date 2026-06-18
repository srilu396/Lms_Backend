const { sequelize, Institution, Student } = require('../src/models');
const studentService = require('../src/services/student.service');

async function runTests() {
    try {
        console.log('Adding institution_id column if not exists...');
        try {
            await sequelize.query('ALTER TABLE students ADD COLUMN institution_id BIGINT;');
        } catch (e) {
            console.log('Column might already exist:', e.message);
        }

        console.log('Creating mock institution...');
        const inst = await Institution.create({
            name: 'Test Institution ABC',
            is_active: true
        });

        console.log('Mock institution created with ID:', inst.id);

        console.log('\n--- Testing createStudent ---');
        const student = await studentService.createStudent({
            first_name: 'Test',
            last_name: 'Student',
            email: `teststudent${Date.now()}@example.com`,
            password: 'password123',
            institution_id: inst.id
        });
        console.log('Student created with institution:', student.institution_id);

        console.log('\n--- Testing getStudentById ---');
        const fetchedStudent = await studentService.getStudentById(student.id);
        console.log('Fetched student institution mapping:');
        console.log('Institution ID:', fetchedStudent.institution_id);
        console.log('Institution Name:', fetchedStudent.institution_name);

        console.log('\n--- Testing getStudents ---');
        const allStudents = await studentService.getStudents({ search: student.email });
        if (allStudents.data.length > 0) {
            console.log('First search result institution mapping:');
            console.log('Institution ID:', allStudents.data[0].institution_id);
            console.log('Institution Name:', allStudents.data[0].institution_name);
        }

        console.log('\n--- Testing bulkUpload validation ---');
        const fs = require('fs');
        const csvContent = `first_name,last_name,email,mobile_number,password,status,institution
Bulk,One,bulkone${Date.now()}@example.com,1234567890,P@ssword,active,Test Institution ABC
Bulk,Two,bulktwo${Date.now()}@example.com,1234567890,P@ssword,active,Invalid Inst XYZ`;
        
        fs.writeFileSync('test_bulk.csv', csvContent);
        
        try {
            await studentService.bulkUploadStudents('test_bulk.csv');
            console.log('Bulk upload succeeded unexpectedly!');
        } catch (err) {
            console.log('Bulk upload correctly threw error:', err.message);
        }

        console.log('\n--- Testing bulkUpload success ---');
        const validCsvContent = `first_name,last_name,email,mobile_number,password,status,institution
Bulk,Valid,bulkvalid${Date.now()}@example.com,1234567890,P@ssword,active,Test Institution ABC`;
        fs.writeFileSync('test_bulk_valid.csv', validCsvContent);
        const bulkResult = await studentService.bulkUploadStudents('test_bulk_valid.csv');
        console.log('Valid bulk upload result:', bulkResult);

        // Cleanup
        console.log('\nCleaning up mock data...');
        await Student.destroy({ where: { email: { [sequelize.Sequelize.Op.like]: '%@example.com' } }, force: true });
        await Institution.destroy({ where: { id: inst.id }, force: true });
        
        console.log('Tests complete!');
    } catch (err) {
        console.error('Error during testing:', err);
    } finally {
        await sequelize.close();
    }
}

runTests();
