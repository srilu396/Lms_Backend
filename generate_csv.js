const { Course, Institution, Tutor, Student, sequelize } = require('./src/models');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const institution = await Institution.findOne({ where: { is_active: true } });
    if (!institution) throw new Error("No active institution found");

    const course = await Course.findOne({ where: { status: 'active' } });
    if (!course) throw new Error("No active course found");

    const tutor = await Tutor.findOne({ where: { status: 'active' } });
    const tutorName = tutor ? tutor.full_name : 'N/A';

    const students = await Student.findAll({ 
        where: { status: 'active', institution_id: institution.id },
        limit: 5
    });

    if (students.length === 0) throw new Error("No active students found for institution " + institution.name);

    let csv = 'name,course,institution,instructor,start_date,end_date,enroll_student,status\n';
    
    const batchName = `Generated Batch ${Date.now()}`;
    const courseName = course.name;
    const instName = institution.name;
    
    const studentNames = students.map(s => `${s.first_name} ${s.last_name || ''}`.trim()).join(',');
    
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    csv += `"${batchName}","${courseName}","${instName}","${tutorName}","${startDate}","${endDate}","${studentNames}","active"\n`;
    
    const outputPath = path.join(__dirname, 'sample_batch_upload.csv');
    fs.writeFileSync(outputPath, csv);
    console.log(`Generated CSV at ${outputPath}`);
    console.log(csv);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}
run();
