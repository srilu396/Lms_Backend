const { 
    Batch, 
    Enrollment, 
    QuizSubmission, 
    sequelize 
} = require('../../models');
const { Op } = require('sequelize');

class GradeDistributionService {
    /**
     * Get grade distribution for a specific batch
     * @param {number} batchId 
     * @param {number} institutionId 
     */
    async getGradeDistribution(batchId, institutionId) {
        // 1. Verify batch and ownership
        const batch = await Batch.findOne({
            where: { id: batchId, institution_id: institutionId }
        });

        if (!batch) {
            const error = new Error('Batch not found or access denied');
            error.statusCode = 404;
            throw error;
        }

        // 2. Fetch all active enrollments in the batch
        const activeEnrollments = await Enrollment.findAll({
            where: { batch_id: batchId, status: 'active' },
            attributes: ['id']
        });

        if (!activeEnrollments.length) {
            return {
                distribution: [
                    { label: "Fail", range: "0-40", count: 0 },
                    { label: "Average", range: "41-80", count: 0 },
                    { label: "Excellent", range: "81-100", count: 0 }
                ]
            };
        }

        const enrollmentIds = activeEnrollments.map(e => e.id);

        // 3. Get average quiz score per student (enrollment)
        const quizAverages = await QuizSubmission.findAll({
            where: { enrollment_id: { [Op.in]: enrollmentIds } },
            attributes: [
                'enrollment_id',
                [sequelize.fn('AVG', sequelize.col('score')), 'avg_score']
            ],
            group: ['enrollment_id'],
            raw: true
        });

        const scoreMap = {};
        quizAverages.forEach(item => {
            scoreMap[item.enrollment_id] = parseFloat(item.avg_score);
        });

        // 4. Categorize each student
        let failCount = 0;
        let averageCount = 0;
        let excellentCount = 0;

        activeEnrollments.forEach(enrollment => {
            const avgScore = scoreMap[enrollment.id] || 0; // Default to 0 if no quizzes
            
            // Rounded average score for bucketing
            const roundedScore = Math.round(avgScore);

            if (roundedScore >= 0 && roundedScore <= 40) {
                failCount++;
            } else if (roundedScore >= 41 && roundedScore <= 80) {
                averageCount++;
            } else if (roundedScore >= 81 && roundedScore <= 100) {
                excellentCount++;
            }
        });

        return {
            distribution: [
                { label: "Fail", range: "0-40", count: failCount },
                { label: "Average", range: "41-80", count: averageCount },
                { label: "Excellent", range: "81-100", count: excellentCount }
            ]
        };
    }
}

module.exports = new GradeDistributionService();
