const { sequelize, Institution, User } = require('../src/models');
const userService = require('../src/services/user.service');

async function runTests() {
    try {
        console.log('--- Setting up DB ---');
        // Ensure institution_id column exists
        try {
            await sequelize.query('ALTER TABLE users ADD COLUMN institution_id BIGINT;');
        } catch (e) {
            console.log('Column might already exist on users:', e.message);
        }

        const inst = await Institution.create({
            name: 'Test Institution Users',
            is_active: true
        });
        console.log('Mock institution created with ID:', inst.id);

        console.log('\n--- Test 1: Create Admin User ---');
        const adminUser = await userService.createUser({
            full_name: 'Admin Test',
            email: `admin_${Date.now()}@example.com`,
            password: 'password123',
            role: 'admin'
        });
        console.log('Admin user created successfully.');

        console.log('\n--- Test 2: Create Ins_Rep User with Institution ---');
        const insRepUser = await userService.createUser({
            full_name: 'Ins Rep Test',
            email: `insrep_${Date.now()}@example.com`,
            password: 'password123',
            role: 'institution_representative',
            institution_id: inst.id
        });
        console.log('Ins_Rep created. Assigned Institution ID:', insRepUser.institution_id);
        console.log('Nested Institution in Create Response:', insRepUser.institution);

        console.log('\n--- Test 3: Get User By ID ---');
        const fetchedInsRep = await userService.getUserById(insRepUser.id);
        console.log('Fetched nested institution:', fetchedInsRep.institution);

        console.log('\n--- Test 4: Get All Users (No Role Filter) ---');
        const allUsers = await userService.getUsers({});
        console.log('Total users returned (should only be admins/ins_reps):', allUsers.pagination.total);
        const rolesFound = new Set(allUsers.data.map(u => u.role));
        console.log('Roles found in default get all:', Array.from(rolesFound));
        
        console.log('\n--- Test 5: Get All Users (Filter Role = admin) ---');
        const adminUsers = await userService.getUsers({ role: 'admin' });
        const adminRolesFound = new Set(adminUsers.data.map(u => u.role));
        console.log('Roles found when filtering admin:', Array.from(adminRolesFound));

        console.log('\n--- Test 6: Get All Users (Filter Role = invalid/tutor) ---');
        const tutorUsers = await userService.getUsers({ role: 'tutor' });
        console.log('Total users returned for tutor filter:', tutorUsers.pagination.total);

        // Cleanup
        console.log('\n--- Cleaning up mock data ---');
        await User.destroy({ where: { email: { [sequelize.Sequelize.Op.like]: '%@example.com' } }, force: true });
        await Institution.destroy({ where: { id: inst.id }, force: true });
        
        console.log('Tests complete!');
    } catch (err) {
        console.error('Error during testing:', err);
    } finally {
        await sequelize.close();
    }
}

runTests();
