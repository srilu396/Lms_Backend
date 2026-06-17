const { connectDB, sequelize } = require('./src/db/connect');
const userService = require('./src/services/user.service');

async function run() {
    await connectDB();
    
    try {
        console.log("Testing Admin Creation...");
        const adminUser = await userService.createUser({
            full_name: "Test Admin",
            email: "test.admin" + Date.now() + "@example.com",
            password: "password123",
            role: "admin",
            is_active: true
        });
        console.log("Admin User Created:", adminUser.id);

        console.log("Testing Institution Rep Creation...");
        const { Institution } = require('./src/models');
        let inst = await Institution.findOne();
        if (!inst) {
            inst = await Institution.create({ name: 'Test Inst' });
        }
        
        const repUser = await userService.createUser({
            full_name: "Test Rep",
            email: "test.rep" + Date.now() + "@example.com",
            password: "password123",
            role: "institution_representative",
            institution_id: inst.id,
            is_active: false
        });
        console.log("Rep User Created:", repUser.id, "is_active:", repUser.is_active);

        console.log("Testing Update User...");
        const updatedRep = await userService.updateUser(repUser.id, {
            full_name: "Updated Rep",
            is_active: true
        });
        console.log("Rep User Updated:", updatedRep.id, "is_active:", updatedRep.is_active, "name:", updatedRep.full_name);
        
        console.log("All tests passed!");
    } catch (e) {
        console.error("Test Failed:", e);
    } finally {
        await sequelize.close();
    }
}

run();
