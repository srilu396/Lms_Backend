const { 
    Batch, 
    Enrollment, 
    QuizSubmission, 
    sequelize 
} = require('../../models');
const { Op } = require('sequelize');
const { verifyBatchOwnership } = require('../../utils/institutionRep.helper');

/**
 * Service for calculating Grade Distribution for a specific batch
 */
class GradeDistributionService {
    /**
     * Calculate distribution of students across grade buckets (Fail, Average, Excellent)
     * @param {number|string} batchId 
     * @param {number|string} institutionId 
     */
    async getGradeDistribution(batchId, institutionId) {
        const batch = await verifyBatchOwnership(batchId, institutionId);

        // 2. Fetch all enrollments for this batch
        const enrollments = await Enrollment.findAll({
            where: { batch_id: batchId },
            attributes: ['id']
        });

        if (enrollments.length === 0) {
            return [
                { label: 'Fail', range: '0-40', count: 0 },
                { label: 'Average', range: '41-80', count: 0 },
                { label: 'Excellent', range: '81-100', count: 0 }
            ];
        }

        const enrollmentIds = enrollments.map(e => e.id);

        // 3. Aggregate average quiz scores per enrollment
        const studentScores = await QuizSubmission.findAll({
            where: { 
                enrollment_id: { [Op.in]: enrollmentIds } 
            },
            attributes: [
                'enrollment_id',
                [sequelize.fn('AVG', sequelize.col('score')), 'avgScore']
            ],
            group: ['enrollment_id'],
            raw: true
        });

        const scoreMap = {};
        studentScores.forEach(item => {
            scoreMap[item.enrollment_id] = parseFloat(item.avgScore || 0);
        });

        // 4. Categorize students into buckets
        let failCount = 0;
        let averageCount = 0;
        let excellentCount = 0;

        enrollments.forEach(enrollment => {
            // Students with no submissions default to 0
            const avgScore = scoreMap[enrollment.id] || 0;
            const roundedScore = Math.round(avgScore);

            if (roundedScore >= 0 && roundedScore <= 40) {
                failCount++;
            } else if (roundedScore >= 41 && roundedScore <= 80) {
                averageCount++;
            } else if (roundedScore >= 81 && roundedScore <= 100) {
                excellentCount++;
            } else {
                // For scores > 100 (if any), count as Excellent? 
                // Usually capped at 100.
                if (roundedScore > 100) excellentCount++;
            }
        });

        return [
            { label: 'Fail', range: '0-40', count: failCount },
            { label: 'Average', range: '41-80', count: averageCount },
            { label: 'Excellent', range: '81-100', count: excellentCount }
        ];
    }
}

module.exports = new GradeDistributionService();
