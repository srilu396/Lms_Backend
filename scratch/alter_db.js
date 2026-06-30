const { sequelize, Course, Module, Lesson, Topic } = require('../src/models');

async function run() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB');

        const [results] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='lessons' AND column_name='topic_id';
        `);

        if (results.length > 0) {
            console.log('Altering tables...');
            
            await sequelize.query('ALTER TABLE topics DROP CONSTRAINT fk_topic_module;');
            await sequelize.query('ALTER TABLE lessons DROP CONSTRAINT fk_lesson_topic;');
            await sequelize.query('ALTER TABLE topics DROP CONSTRAINT uq_topic_order;');
            await sequelize.query('ALTER TABLE lessons DROP CONSTRAINT uq_lesson_order;');
            
            await sequelize.query('ALTER TABLE topics RENAME COLUMN module_id TO lesson_id;');
            await sequelize.query('ALTER TABLE lessons RENAME COLUMN topic_id TO module_id;');

            await sequelize.query('ALTER TABLE topics ADD CONSTRAINT fk_topic_lesson FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE;');
            await sequelize.query('ALTER TABLE topics ADD CONSTRAINT uq_topic_order UNIQUE (lesson_id, order_num);');

            await sequelize.query('ALTER TABLE lessons ADD CONSTRAINT fk_lesson_module FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE;');
            await sequelize.query('ALTER TABLE lessons ADD CONSTRAINT uq_lesson_order UNIQUE (module_id, order_num);');
            
            console.log('Altered successfully.');
        } else {
            console.log('Tables already altered.');
        }

        const courses = await Course.findAll({ include: { all: true, nested: true } });
        console.log('Test fetch successful. Found', courses.length, 'courses.');
    } catch (e) {
        console.error(e);
    } finally {
        await sequelize.close();
    }
}
run();
