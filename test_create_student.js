const { sequelize, Student } = require('./src/models');
async function test() {
    try {
        await Student.create({
            id: 48,
            first_name: 'Test',
            last_name: 'Test',
            email: 'test48@example.com',
            password: 'dummy'
        });
        console.log('Success');
    } catch(e) {
        console.error(e);
    } finally {
        sequelize.close();
    }
}
test();
