const { sequelize, Batch, Enrollment, User } = require('./src/models');

async function testQuery() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB');

        const enrollments = await Enrollment.findAll({ limit: 5 });
        console.log(`Found ${enrollments.length} enrollments`);
        for (const enr of enrollments) {
            console.log(`Enrollment ID: ${enr.id}, Student ID: ${enr.student_id}`);
            const user = await User.findByPk(enr.student_id);
            if (user) {
                console.log(`Found user: ${user.full_name} (${user.id})`);
            } else {
                console.log(`User not found for ID: ${enr.student_id}`);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}
testQuery();
