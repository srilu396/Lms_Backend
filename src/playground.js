require('dotenv').config();
const models = require('./models/index');

async function runPlayground() {
    try {
        console.log("--- STARTING SEQUELIZE PLAYGROUND ---\n");

        // --- 1. Cleanup old tests to prevent unique constraint errors ---
        await models.User.destroy({ where: { username: 'alex_test' }, force: true });
        await models.Course.destroy({ where: { name: 'Sequelize 101' }, force: true });
        await models.Batch.destroy({ where: { name: 'Batch A - Sequelize' }, force: true });

        // --- 2. Insert a Sample User (Part B) ---
        console.log("[1/3] Creating a sample User structure...");

        const newUser = await models.User.create({
            username: 'alex_test',
            email: 'alex.test@playground.com',
            full_name: 'Alex Testing',
            role: 'student',
            password_hash: 'super_secret',
            is_active: true
        });
        console.log(`   ✅ Created User: ${newUser.username} (ID: ${newUser.id})`);

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
        console.log("   ✅ Appended a Mock Enrollment, Batch, and Course relationship!");

        // --- 3. Fetch User with Associations (Part C) ---
        console.log("\n[2/3] Fetching user with related 'Enrollment' -> 'Batch' -> 'Course' inclusions...");
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

        console.log("   ✅ Successfully retrieved complex relationships:");
        console.log(JSON.stringify(userWithAssociations, null, 2));

        // --- 4. Fetch All Users (Part A) ---
        console.log("\n[3/3] Fetching all users in the database using findAll()...");
        const allUsers = await models.User.findAll({
            attributes: ['id', 'username', 'email', 'role'] // Keeping it brief for log output
        });
        console.log(`   ✅ Found ${allUsers.length} user(s) currently stored:`);
        console.table(allUsers.map(user => user.toJSON()));

    } catch (error) {
        console.error("\n❌ Error inside playground test execution:");
        console.error(error);
    } finally {
        // Disconnect DB connection so the process exits natively
        await models.sequelize.close();
        console.log("\n--- PLAYGROUND FINISHED. Connection closed. ---");
    }
}

// Execute the playground function
runPlayground();
