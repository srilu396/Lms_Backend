const { connectDB } = require('../src/db/connect');
const { QuizSubmission, Quiz, Enrollment, Batch } = require('../src/models');

async function testAvgQuiz() {
    await connectDB();
    console.log("Connected to DB.");

    const submissions = await QuizSubmission.findAll({
        attributes: ['score'],
        include: [
            {
                model: Quiz,
                required: true,
                attributes: ['total_marks']
            },
            {
                model: Enrollment,
                required: true,
                attributes: [],
                include: [{
                    model: Batch,
                    required: true,
                    where: { institution_id: 9 },
                    attributes: []
                }]
            }
        ],
        raw: true,
        nest: true
    });

    console.log("Submissions (first 3):", JSON.stringify(submissions.slice(0, 3), null, 2));
    process.exit(0);
}

testAvgQuiz().catch(err => {
    console.error(err);
    process.exit(1);
});
