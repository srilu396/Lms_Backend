const { connectDB, sequelize } = require('../src/db/connect');
const dashboardService = require('../src/services/institutionRep/dashboard.service');
const { User } = require('../src/models');

async function benchmark() {
    await connectDB();
    console.log("Connected to DB.");

    const user = await User.findOne({ where: { email: 'kietwomens@gmail.com' } });
    if (!user) {
        console.error("User not found!");
        process.exit(1);
    }
    const instId = user.institution_id;
    console.log(`Using Institution ID for kietwomens@gmail.com: ${instId}`);

    sequelize.options.logging = console.log;

    console.log("\n--- STARTING getStats ---");
    console.time("getStats");
    await dashboardService.getStats(instId);
    console.timeEnd("getStats");

    console.log("\n--- STARTING getMonitoringList ---");
    console.time("getMonitoringList");
    await dashboardService.getMonitoringList(instId, { page: 1, limit: 10, search: '', batch_id: 'all' });
    console.timeEnd("getMonitoringList");
    
    process.exit(0);
}

benchmark().catch(err => {
    console.error(err);
    process.exit(1);
});
