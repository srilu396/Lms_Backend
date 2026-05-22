require('dotenv').config();
const { connectDB } = require('./src/db/connect');
const { Student, sequelize } = require('./src/models');

async function testBulkCreate() {
    await connectDB();
    try {
        console.log("Testing bulkCreate...");
        const newStudents = await Student.bulkCreate([
            { first_name: "John", last_name: "Doe", email: "john" + Math.random() + "@test.com", password: "pwd" }
        ], { individualHooks: true });
        
        console.log("Returned from bulkCreate:");
        newStudents.forEach(s => console.log(s.id, s.email));
        
    } catch (error) {
        console.error("Test Error:", error);
    }
    process.exit(0);
}

testBulkCreate();
