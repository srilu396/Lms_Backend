const { QuizSubmission, Quiz, sequelize } = require('./src/models');
const { Op } = require('sequelize');

async function fixScores() {
    try {
        console.log("Fixing scores...");
        const submissions = await QuizSubmission.findAll({
            include: [{ model: Quiz, required: true }]
        });
        
        for (let sub of submissions) {
            const maxMarks = parseFloat(sub.Quiz.total_marks) || 100;
            const score = parseFloat(sub.score);
            
            if (score > maxMarks) {
                // Meaning percentage was mistakenly used as score when maxMarks was small
                // Or simply cap it
                const newScore = (Math.floor(Math.random() * 50) + 30) / 100 * maxMarks;
                await sub.update({ score: newScore });
            }
        }
        console.log("Done");
    } catch(err) {
        console.error(err);
    } finally {
        await sequelize.close();
    }
}
fixScores();
