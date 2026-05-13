const { Batch, Enrollment, QuizSubmission, Quiz, User, sequelize } = require('../../models');
const { Op } = require('sequelize');

class StudentPerformanceService {
    async getSummary(institutionId, term = 'current') {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // 1. Find batches for the term
        let batchWhere = { institution_id: institutionId };
        
        let prevBatchWhere = { institution_id: institutionId };

        if (term === 'current') {
            batchWhere = {
                ...batchWhere,
                [Op.or]: [
                    { status: 'active' },
                    {
                        start_date: { [Op.lte]: todayStr },
                        end_date: { [Op.gte]: todayStr }
                    }
                ]
            };
            prevBatchWhere = {
                ...prevBatchWhere,
                [Op.or]: [
                    { status: 'completed' },
                    { end_date: { [Op.lt]: todayStr } }
                ]
            };
        } else if (term === 'past') {
            batchWhere = {
                ...batchWhere,
                [Op.or]: [
                    { status: 'completed' },
                    { end_date: { [Op.lt]: todayStr } }
                ]
            };
            // "term before that" - let's assume anything older than the max start date of these past batches, 
            // but since "past" encompasses all history, "term before that" might be empty.
            // We'll leave it as an impossible condition to return null safely, 
            // or we could define a specific cutoff. We'll use a dummy condition that returns nothing.
            prevBatchWhere = {
                id: -1 // effectively returning null for most_improved
            };
        }

        const batches = await Batch.findAll({ where: batchWhere, attributes: ['id'] });
        const batchIds = batches.map(b => b.id);

        if (batchIds.length === 0) {
            return this.getEmptyResponse(term);
        }

        // 2. Find students in these batches
        const enrollments = await Enrollment.findAll({
            where: { batch_id: { [Op.in]: batchIds } },
            attributes: ['id', 'student_id']
        });

        const enrollmentIds = enrollments.map(e => e.id);
        const studentIds = [...new Set(enrollments.map(e => e.student_id))];

        if (studentIds.length === 0) {
            return this.getEmptyResponse(term);
        }

        // Fetch student names
        const students = await User.findAll({
            where: { id: { [Op.in]: studentIds } },
            attributes: ['id', 'full_name']
        });
        const studentMap = {};
        students.forEach(s => { studentMap[s.id] = s.full_name });

        // 3. Submissions for current term
        const submissions = await QuizSubmission.findAll({
            where: { enrollment_id: { [Op.in]: enrollmentIds } },
            include: [
                { model: Quiz, attributes: ['id', 'total_marks'] }
            ]
        });

        const finalScores = this.calculateStudentScores(studentIds, submissions, studentMap);

        // Calculate KPI
        let highest_performer = null;
        let class_average = { average_percent: 0 };
        
        if (finalScores.length > 0) {
            const highest = finalScores.reduce((prev, current) => (prev.avg_quiz_score > current.avg_quiz_score) ? prev : current);
            highest_performer = {
                student_id: highest.student_id,
                student_name: highest.student_name,
                score_percent: highest.avg_quiz_score
            };

            const total = finalScores.reduce((acc, curr) => acc + curr.avg_quiz_score, 0);
            class_average.average_percent = Math.round(total / finalScores.length);
        }

        // Most Improved logic
        let most_improved = null;
        const prevBatches = await Batch.findAll({ where: prevBatchWhere, attributes: ['id'] });
        const prevBatchIds = prevBatches.map(b => b.id);
        
        if (prevBatchIds.length > 0) {
            const prevEnrollments = await Enrollment.findAll({
                where: { 
                    batch_id: { [Op.in]: prevBatchIds },
                    student_id: { [Op.in]: studentIds } // only compare students in current term
                },
                attributes: ['id', 'student_id']
            });
            const prevEnrollmentIds = prevEnrollments.map(e => e.id);
            
            if (prevEnrollmentIds.length > 0) {
                const prevSubmissions = await QuizSubmission.findAll({
                    where: { enrollment_id: { [Op.in]: prevEnrollmentIds } },
                    include: [{ model: Quiz, attributes: ['id', 'total_marks'] }]
                });
                
                const prevScores = this.calculateStudentScores(studentIds, prevSubmissions, studentMap);
                const prevScoreMap = {};
                prevScores.forEach(s => { prevScoreMap[s.student_id] = s.avg_quiz_score; });

                let maxImprovement = 0;
                let improvedStudent = null;

                finalScores.forEach(curr => {
                    if (prevScoreMap[curr.student_id] !== undefined) {
                        const improvement = curr.avg_quiz_score - prevScoreMap[curr.student_id];
                        if (improvement > 0 && improvement > maxImprovement) {
                            maxImprovement = improvement;
                            improvedStudent = curr;
                        }
                    }
                });

                if (improvedStudent) {
                    most_improved = {
                        student_id: improvedStudent.student_id,
                        student_name: improvedStudent.student_name,
                        improvement_percent: `+${maxImprovement}`
                    };
                }
            }
        }

        // 5. Distribution Tiers
        let highCount = 0;
        let averageCount = 0;
        let belowCount = 0;
        let riskCount = 0;

        finalScores.forEach(s => {
            const score = s.avg_quiz_score;
            if (score >= 90) highCount++;
            else if (score >= 70) averageCount++;
            else if (score >= 60) belowCount++;
            else riskCount++;
        });

        const total_students = finalScores.length;
        const getPct = (count) => total_students === 0 ? 0 : Math.round((count / total_students) * 100);

        const distribution_tiers = [
            { tier_key: "high", label: "HIGH (90%+)", student_count: highCount, percentage: getPct(highCount) },
            { tier_key: "average", label: "AVERAGE (70-89%)", student_count: averageCount, percentage: getPct(averageCount) },
            { tier_key: "below_average", label: "BELOW AVERAGE (60-69%)", student_count: belowCount, percentage: getPct(belowCount) },
            { tier_key: "at_risk", label: "AT RISK (<60%)", student_count: riskCount, percentage: getPct(riskCount) }
        ];

        return {
            term,
            kpi: {
                highest_performer,
                class_average,
                most_improved
            },
            distribution_tiers,
            total_students
        };
    }

    calculateStudentScores(studentIds, submissions, studentMap) {
        const studentScores = {};
        studentIds.forEach(id => {
            studentScores[id] = { sumPct: 0, count: 0 };
        });

        submissions.forEach(sub => {
            const studentId = sub.student_id;
            if (!studentScores[studentId]) return;

            const scoreObtained = parseFloat(sub.score) || 0;
            const totalMarks = sub.Quiz && sub.Quiz.total_marks ? parseFloat(sub.Quiz.total_marks) : 100;
            
            const pct = (scoreObtained / totalMarks) * 100;
            studentScores[studentId].sumPct += pct;
            studentScores[studentId].count += 1;
        });

        const finalScores = [];
        studentIds.forEach(id => {
            const data = studentScores[id];
            let avgScore = 0;
            if (data.count > 0) {
                avgScore = Math.round(data.sumPct / data.count);
            }
            finalScores.push({
                student_id: id,
                student_name: studentMap[id] || 'Unknown',
                avg_quiz_score: avgScore
            });
        });

        return finalScores;
    }

    getEmptyResponse(term) {
        return {
            term,
            kpi: {
                highest_performer: null,
                class_average: { average_percent: 0 },
                most_improved: null
            },
            distribution_tiers: [
                { tier_key: "high", label: "HIGH (90%+)", student_count: 0, percentage: 0 },
                { tier_key: "average", label: "AVERAGE (70-89%)", student_count: 0, percentage: 0 },
                { tier_key: "below_average", label: "BELOW AVERAGE (60-69%)", student_count: 0, percentage: 0 },
                { tier_key: "at_risk", label: "AT RISK (<60%)", student_count: 0, percentage: 0 }
            ],
            total_students: 0
        };
    }
}

module.exports = new StudentPerformanceService();
