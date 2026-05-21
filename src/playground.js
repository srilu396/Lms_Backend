require('dotenv').config();
const models = require('./models/index');

async function runPlayground() {
    try {

        // --- 1. Cleanup old tests to prevent unique constraint errors ---
        await models.User.destroy({ where: { username: 'alex_test' }, force: true });
        await models.Course.destroy({ where: { name: 'Sequelize 101' }, force: true });
        await models.Batch.destroy({ where: { name: 'Batch A - Sequelize' }, force: true });

        // --- 2. Insert a Sample User (Part B) ---

        const newUser = await models.User.create({
            username: 'alex_test',
            email: 'alex.test@playground.com',
            full_name: 'Alex Testing',
            role: 'student',
            password_hash: 'super_secret',
            is_active: true
        });

        // Let's also attach some real relational data to test (Course -> Batch -> Enrollment)
        const newCourse = await models.Course.create({
            name: 'Sequelize 101',
            status: 'active'
        });

        const newBatch = await models.Batch.create({
            name: 'Batch A - Sequelize',
            start_date: '2026-03-01',
            course_id: newCourse.id,
            status: 'active'
        });

        await models.Enrollment.create({
            student_id: newUser.id,
            batch_id: newBatch.id,
            status: 'active'
        });

        // --- 3. Fetch User with Associations (Part C) ---
        const userWithAssociations = await models.User.findOne({
            where: { id: newUser.id },
            include: [
                {
                    model: models.Enrollment,
                    include: [
                        {
                            model: models.Batch,
                            include: [
                                { model: models.Course }
                            ]
                        }
                    ]
                }
            ]
        });


        // --- 4. Fetch All Users (Part A) ---
        const allUsers = await models.User.findAll({
            attributes: ['id', 'username', 'email', 'role'] // Keeping it brief for log output
        });
        console.table(allUsers.map(user => user.toJSON()));

    } catch (error) {
    } finally {
        // Disconnect DB connection so the process exits natively
        await models.sequelize.close();
    }
}

// Execute the playground function
runPlayground();
