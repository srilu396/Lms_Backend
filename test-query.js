const { Batch, Enrollment, Student, Institution, User, sequelize, Sequelize } = require('./src/models');
const { Op } = Sequelize;

async function test() {
    try {
        const batchId = 10;
        const { count, rows } = await Enrollment.findAndCountAll({
            where: { batch_id: batchId },
            include: [
                {
                    model: Student,
                    as: 'student',
                    attributes: ['id', 'first_name', 'last_name', 'email']
                }
            ],
            limit: 10,
            offset: 0,
            order: [['created_at', 'DESC']]
        });
        console.log(count, rows);
    } catch(err) {
        console.error("ERROR:");
        console.error(err);
    }
}
test();
