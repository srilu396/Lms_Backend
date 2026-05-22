const { User, Student } = require('../src/models');

async function checkUser() {
    try {
        const studentId = 265;
        const user = await User.findByPk(studentId);
        console.log('User 265:', user ? JSON.stringify(user, null, 2) : 'Not found');
        
        const student = await Student.findByPk(studentId);
        console.log('Student 265:', student ? JSON.stringify(student, null, 2) : 'Not found');
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

checkUser();
