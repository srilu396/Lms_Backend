require('dotenv').config();
const { sequelize, User, BatchTutor, Batch } = require('./src/models');

async function test() {
  try {
    const user = await User.findOne({ where: { email: 'manideeptutor@gmail.com' } });
    if (!user) {
      console.log('User not found');
      return;
    }
    
    await BatchTutor.findOrCreate({ where: { tutor_id: user.id, batch_id: 1 } });
    await BatchTutor.findOrCreate({ where: { tutor_id: user.id, batch_id: 2 } });
    await BatchTutor.findOrCreate({ where: { tutor_id: user.id, batch_id: 19 } });

    console.log('Successfully assigned batches to tutor');
  } catch (error) {
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

test();
