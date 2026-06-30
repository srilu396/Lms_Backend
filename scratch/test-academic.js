const fs = require('fs');
const path = require('path');
const { Batch, Enrollment } = require('../src/models');
const batchStudentsService = require('../src/services/institutionRep/batch-students.service');
const reportsService = require('../src/services/institutionRep/reports.service');

async function test() {
  try {
    // Find a valid enrollment
    const enrollment = await Enrollment.findOne({
      include: [
        { model: Batch, required: true }
      ]
    });

    if (!enrollment) {
      console.log("No enrollment found in DB to test with.");
      process.exit(0);
    }

    const batchId = enrollment.batch_id;
    const studentId = enrollment.student_id;
    const institutionId = enrollment.Batch.institution_id;

    console.log(`Testing getAcademicPerformance for batchId=${batchId}, studentId=${studentId}, institutionId=${institutionId}...`);
    const performanceResult = await batchStudentsService.getAcademicPerformance(batchId, studentId, institutionId, { page: 1, limit: 10, type: 'all' });
    console.log("Academic Performance Success! Submissions count:", performanceResult.submissions.length);
    console.log("Sample submissions:", performanceResult.submissions.slice(0, 3));

    console.log(`Testing generateReportPdf progress report for institutionId=${institutionId}...`);
    const { filename, doc } = await reportsService.generateReportPdf(institutionId, 'progress');
    console.log("PDF generation finished! Filename:", filename);

    const outPath = path.join(__dirname, 'progress_report_test.pdf');
    const writeStream = fs.createWriteStream(outPath);
    doc.pipe(writeStream);
    doc.end();

    writeStream.on('finish', () => {
      console.log(`Successfully wrote PDF to ${outPath}`);
      process.exit(0);
    });
  } catch (e) {
    console.error("Test failed with error:", e);
    process.exit(1);
  }
}
test();
