const { connectDB } = require('../src/db/connect');
const { Institution } = require('../src/models');

async function testRecentReports(institutionId) {
    console.time("Original Fetch");
    const institutionOrig = await Institution.findByPk(institutionId);
    const institutionNameOrig = institutionOrig.name;
    console.timeEnd("Original Fetch");

    console.time("Optimized Fetch");
    const institutionOpt = await Institution.findByPk(institutionId, {
        attributes: ['name'],
        raw: true
    });
    const institutionNameOpt = institutionOpt.name;
    console.timeEnd("Optimized Fetch");

    console.log("Names equal:", institutionNameOrig === institutionNameOpt);
}

async function verify() {
    await connectDB();
    console.log("Connected to DB.");
    await testRecentReports(9);
    process.exit(0);
}

verify().catch(err => {
    console.error(err);
    process.exit(1);
});
