const { Sequelize } = require('sequelize');
const db = require('../src/models');

async function run() {
  try {
    const course = await db.Course.findByPk(10, {
      include: [
        {
          model: db.Module,
          as: 'modules',
          include: [
            {
                model: db.Quiz,
                as: 'quizzes',
                include: [{ model: db.QuizQuestion }]
            }
          ]
        }
      ]
    });
    console.log("Success");
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
