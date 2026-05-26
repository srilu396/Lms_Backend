const { connectDB } = require('../src/db/connect');
const { Enrollment, Student, Batch } = require('../src/models');

async function testNest() {
    await connectDB();
    console.log("Connected to DB.");

    const sample = await Enrollment.findOne({
        include: [
            {
                model: Student,
                as: 'student',
                attributes: ['id', 'first_name', 'last_name']
            },
            {
                model: Batch,
                attributes: ['id', 'name']
            }
        ],
        raw: true,
        nest: true
    });

    console.log("Sample with raw: true, nest: true:", JSON.stringify(sample, null, 2));
    process.exit(0);
}

testNest().catch(err => {
    console.error(err);
    process.exit(1);
});
