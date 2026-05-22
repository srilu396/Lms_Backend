const { sequelize } = require('./src/db/connect');

async function check() {
    try {
        const [results] = await sequelize.query("SELECT column_name FROM information_schema.columns WHERE table_name='users';");
        console.log(results.map(r => r.column_name));
    } catch(e) {
        console.error(e);
    } finally {
        sequelize.close();
    }
}
check();
