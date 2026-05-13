const { Batch, Enrollment, QuizSubmission, Quiz, User, Student, BatchAssignment, AssignmentSubmission, sequelize } = require('../../models');
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

    async getMetrics(institutionId, params) {
        const { page = 1, limit = 10, search = '', batch_id = 'all' } = params;
        const offset = (page - 1) * limit;

        // 1. Get all batches for this institution for filters
        const allBatches = await Batch.findAll({
            where: { institution_id: institutionId },
            attributes: ['id', 'name']
        });

        const batch_filters = allBatches.map(b => ({
            batch_id: b.id,
            batch_name: b.name
        }));

        // 2. Identify selected batches
        let selectedBatchIds;
        if (batch_id && batch_id !== 'all') {
            const batchIdInt = parseInt(batch_id);
            const exists = allBatches.find(b => b.id === batchIdInt);
            if (!exists) {
                const error = new Error('Access denied: Batch does not belong to this institution');
                error.statusCode = 403;
                throw error;
            }
            selectedBatchIds = [batchIdInt];
        } else {
            selectedBatchIds = allBatches.map(b => b.id);
        }

        if (selectedBatchIds.length === 0) {
            return {
                students: [],
                batch_filters,
                pagination: { 
                    page: parseInt(page), 
                    limit: parseInt(limit), 
                    total: 0, 
                    totalPages: 0 
                }
            };
        }

        // 3. Get students in these batches with search filter
        let studentWhere = {};
        if (search) {
            studentWhere[Op.or] = [
                { first_name: { [Op.iLike]: `%${search}%` } },
                { last_name: { [Op.iLike]: `%${search}%` } }
            ];
        }
        
        // Find students matching search
        const matchingStudents = await Student.findAll({
            where: studentWhere,
            attributes: ['id']
        });
        const matchingStudentIds = matchingStudents.map(s => s.id);

        if (matchingStudentIds.length === 0) {
            return {
                students: [],
                batch_filters,
                pagination: { 
                    page: parseInt(page), 
                    limit: parseInt(limit), 
                    total: 0, 
                    totalPages: 0 
                }
            };
        }

        // 4. Find enrollments with pagination
        const { count, rows: enrollments } = await Enrollment.findAndCountAll({
            where: { 
                batch_id: { [Op.in]: selectedBatchIds },
                student_id: { [Op.in]: matchingStudentIds }
            },
            include: [
                {
                    model: Batch,
                    attributes: ['id', 'name']
                },
                {
                    model: Student,
                    as: 'student',
                    attributes: ['id', 'first_name', 'last_name']
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']]
        });

        // 5. Calculate metrics for each student in the batch
        const studentsData = await Promise.all(enrollments.map(async (enrollment) => {
            const studentId = enrollment.student_id;
            const enrollmentId = enrollment.id;
            const batchId = enrollment.batch_id;
            const student = enrollment.student;

            const studentName = student ? `${student.first_name} ${student.last_name}`.trim() : 'Unknown';

            // Calculate avg_quiz_score
            const quizSubmissions = await QuizSubmission.findAll({
                where: { enrollment_id: enrollmentId },
                include: [{ model: Quiz, attributes: ['total_marks'] }]
            });

            let avg_quiz_score = 0;
            if (quizSubmissions.length > 0) {
                let totalPct = 0;
                quizSubmissions.forEach(sub => {
                    const score = parseFloat(sub.score) || 0;
                    const totalMarks = (sub.Quiz && sub.Quiz.total_marks) ? parseFloat(sub.Quiz.total_marks) : 100;
                    totalPct += (score / totalMarks) * 100;
                });
                avg_quiz_score = parseFloat((totalPct / quizSubmissions.length).toFixed(1));
            }

            // Calculate assignments_completed
            const assignments_completed = await AssignmentSubmission.count({
                where: { 
                    enrollment_id: enrollmentId, 
                    status: { [Op.in]: ['submitted', 'graded'] } 
                }
            });

            // Calculate assignments_total
            const assignments_total = await BatchAssignment.count({
                where: { batch_id: batchId }
            });

            // Determine overall_grade
            let overall_grade = 'F';
            if (avg_quiz_score >= 90) overall_grade = 'A+';
            else if (avg_quiz_score >= 80) overall_grade = 'A';
            else if (avg_quiz_score >= 70) overall_grade = 'B';
            else if (avg_quiz_score >= 60) overall_grade = 'C';
            else if (avg_quiz_score >= 50) overall_grade = 'D';

            return {
                student_id: Number(studentId),
                student_name: studentName,
                avatar_url: null,
                batch_id: batchId,
                batch_name: enrollment.Batch ? enrollment.Batch.name : 'Unknown',
                avg_quiz_score,
                assignments_completed,
                assignments_total,
                overall_grade
            };
        }));

        return {
            students: studentsData,
            batch_filters,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        };
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
