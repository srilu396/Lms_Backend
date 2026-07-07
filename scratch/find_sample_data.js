const { Institution, Course, Tutor, Student, sequelize } = require('../src/models');

async function run() {
    const inst = await Institution.findOne({ where: { is_active: true } });
    const course1 = await Course.findOne({ where: { status: 'active' } });
    const course2 = await Course.findOne({ where: { status: 'active', id: { [require('sequelize').Op.ne]: course1.id } } });
    const tutor1 = await Tutor.findOne({ where: { status: 'active' } });
    
    // Find students belonging to this institution
    const students = await Student.findAll({ where: { status: 'active', institution_id: inst.id }, limit: 4 });
    
    console.log(`Institution: ${inst.name}`);
    console.log(`Course 1: ${course1.name}`);
    console.log(`Course 2: ${course2 ? course2.name : course1.name}`);
    console.log(`Tutor: ${tutor1.full_name}`);
    console.log(`Students:`, students.map(s => `${s.first_name} ${s.last_name || ''}`.trim()));
    
    await sequelize.close();
}

run();
