const { sequelize, User, Batch, Enrollment } = require('./src/models');

async function testQuery() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB');

        const instRep = await User.findOne({ where: { email: 'kietwomens@gmail.com' } });
        if (!instRep) {
            console.log('Institution Rep not found');
            return;
        }

        const institutionId = instRep.institution_id;
        console.log('Institution ID:', institutionId);

        // Find users who are students and belong to this institution
        const { Student } = require('./src/models');
        const validUsers = await User.findAll({ 
            where: { 
                role: 'student', 
                institution_id: institutionId 
            } 
        });
        console.log(`Found ${validUsers.length} users (students) for this institution`);

        const validStudentUsers = [];
        for (const u of validUsers) {
            const stu = await Student.findByPk(u.id);
            if (stu) {
                validStudentUsers.push(u);
            }
        }
        console.log(`Found ${validStudentUsers.length} users that ALSO exist in the 'students' table.`);

        if (validStudentUsers.length > 0) {
            console.log(`IDs: ${validStudentUsers.map(u => u.id).join(', ')}`);
        }
        
        // Total enrollments
        const enrollments = await Enrollment.findAll();
        console.log(`Total enrollments in DB: ${enrollments.length}`);
        
        // Filter valid enrollments
        let validEnrollmentCount = 0;
        for (const enr of enrollments) {
            const u = await User.findByPk(enr.student_id);
            if (u) {
                validEnrollmentCount++;
            }
        }
        
        console.log(`Valid enrollments (student exists in users): ${validEnrollmentCount}`);
        
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}
testQuery();
