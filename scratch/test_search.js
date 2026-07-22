const { Enrollment, Student, Batch, sequelize } = require('../src/models');
const { Op } = require('sequelize');

async function testQuery(search) {
    const batchId = 1; // Assuming a batch exists
    const studentWhere = {};
    if (search) {
        studentWhere[Op.or] = [
            sequelize.where(sequelize.fn('concat', sequelize.col('student.first_name'), ' ', sequelize.col('student.last_name')), {
                [Op.iLike]: `%${search}%`
            }),
            { first_name: { [Op.iLike]: `%${search}%` } },
            { last_name: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } }
        ];
    }

    try {
        const { rows, count } = await Enrollment.findAndCountAll({
            where: { batch_id: batchId },
            include: [{
                model: Student,
                as: 'student',
                where: Object.keys(studentWhere).length > 0 ? studentWhere : undefined,
                required: Object.keys(studentWhere).length > 0,
                attributes: ['id', 'first_name', 'last_name', 'email']
            }],
            logging: console.log
        });
        
        console.log(`Count: ${count}`);
        console.log(`Rows: ${rows.length}`);
    } catch (e) {
        console.error("Error executing query:", e);
    } finally {
        await sequelize.close();
    }
}

testQuery('anilsai');
