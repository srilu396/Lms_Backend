const { 
    Batch, 
    Course, 
    Domain, 
    User, 
    Enrollment, 
    Module, 
    Lesson, 
    Quiz, 
    Assignment, 
    LessonProgress, 
    AssignmentSubmission, 
    QuizSubmission,
    Institution,
    AttendanceSession,
    StudentAttendance,
    sequelize
} = require('../../models');
const { Op } = require('sequelize');

class InstitutionRepBatchService {
    /**
     * Get list of batches with full stats and filtering
     */
    async getBatches(query, institutionId) {
        // Normalize params (handle Page, Limit, Search, Filter)
        const page = parseInt(query.page || query.Page || 1);
        const limit = parseInt(query.limit || query.Limit || 10);
        const search = query.search || query.Search || '';
        const department = query.department || query.Filter || null;

        const offset = (page - 1) * limit;

        // Build where clause for Batch
        const whereBatch = { institution_id: institutionId };
        
        if (department) {
            whereBatch.department = { [Op.iLike]: `%${department}%` };
        }

        if (search) {
            whereBatch[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { '$tutors.full_name$': { [Op.iLike]: `%${search}%` } }
            ];
        }

        const { rows: batches, count } = await Batch.findAndCountAll({
            where: whereBatch,
            include: [
                { 
                    model: Course,
                    attributes: ['id', 'name']
                },
                { 
                    model: Institution,
                    attributes: ['id', 'name']
                },
                { model: User, as: 'tutors', attributes: ['id', 'full_name'] }
            ],
            limit,
            offset,
            order: [['created_at', 'DESC']],
            distinct: true,
            subQuery: false
        });

        const formattedBatches = [];

        for (const batch of batches) {
            const stats = await this.calculateBatchProgress(batch);
            
            formattedBatches.push({
                id: batch.id,
                batch_id: `#BATCH-${batch.id}`,
                batch_name: batch.name,
                institution_name: batch.Institution?.name || 'N/A',
                tutor: (batch.tutors && batch.tutors.length > 0) ? batch.tutors.map(t => t.full_name).join(', ') : 'Unassigned',
                course: batch.Course?.name || 'N/A',
                department: batch.department || 'Design', // Default to Design if null as per example
                start_date: batch.start_date,
                status: batch.status,
                total_students: batch.Enrollments ? batch.Enrollments.length : 0,
                progress_percentage: stats.progress_percentage,
                progress_status: stats.progress_status
            });
        }

        // Fetch unique departments for this institution
        const filterOptions = await this.getFilterOptions(institutionId);

        return {
            batches: formattedBatches,
            filters: filterOptions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        };
    }

    /**
     * Calculate aggregate progress for a batch
     */
    async calculateBatchProgress(batch) {
        let studentIds = [];
        
        if (batch.Enrollments) {
            studentIds = batch.Enrollments.map(e => e.student_id);
        } else {
            // Fetch dynamically if not pre-included
            const enrollments = await Enrollment.findAll({ 
                where: { batch_id: batch.id },
                attributes: ['id', 'student_id']
            });
            studentIds = enrollments.map(e => e.student_id);
            // Attach to batch object for downstream use if needed
            batch.Enrollments = enrollments; 
        }

        if (!studentIds.length) return { progress_percentage: 0, progress_status: 'upcoming' };

        // 1. Get total content in course
        const courseId = batch.course_id;
        const totalItemsInCourse = await this.getTotalItemsInCourse(courseId);
        
        if (totalItemsInCourse === 0) return { progress_percentage: 0, progress_status: 'on_track' };

        // 2. Get completions for all students
        const completionCounts = await Promise.all(studentIds.map(async (studentId) => {
            const enrollment = batch.Enrollments.find(e => e.student_id === studentId);
            const enrollmentId = enrollment.id;

            const lessons = await LessonProgress.count({ 
                where: { enrollment_id: enrollmentId, is_completed: true } 
            });
            const assignments = await AssignmentSubmission.count({ 
                where: { enrollment_id: enrollmentId, status: { [Op.in]: ['submitted', 'graded'] } } 
            });
            const quizzes = await QuizSubmission.count({ 
                where: { enrollment_id: enrollmentId, status: { [Op.in]: ['completed', 'reviewed'] } } 
            });

            return lessons + assignments + quizzes;
        }));

        const totalCompletions = completionCounts.reduce((a, b) => a + b, 0);
        const maxPossibleCompletions = totalItemsInCourse * studentIds.length;
        
        const progressPercentage = Math.round((totalCompletions / maxPossibleCompletions) * 100);

        // 3. Logic for status
        let progressStatus = 'on_track';
        if (progressPercentage === 100) {
            progressStatus = 'completed';
        } else {
            // Check if behind schedule
            const today = new Date();
            const start = new Date(batch.start_date);
            const end = new Date(batch.end_date);
            
            if (today < start) {
                progressStatus = 'upcoming';
            } else if (today > end) {
                progressStatus = progressPercentage === 100 ? 'completed' : 'at_risk';
            } else {
                const totalDuration = end - start;
                const elapsed = today - start;
                const expectedProgress = (elapsed / totalDuration) * 100;

                if (progressPercentage < expectedProgress - 10 || progressPercentage < 60) {
                    progressStatus = 'at_risk';
                }
            }
        }

        return {
            progress_percentage: progressPercentage,
            progress_status: progressStatus
        };
    }

    async getTotalItemsInCourse(courseId) {
        try {
            // Count Lessons
            let lessonsCount = 0;
            try {
                // Try refactored hierarchy (lessons -> modules)
                const [lessonsResult] = await sequelize.query(`
                    SELECT COUNT(DISTINCT l.id) as count 
                    FROM lessons l
                    JOIN modules m ON l.module_id = m.id
                    WHERE m.course_id = :courseId
                `, { replacements: { courseId }, type: sequelize.QueryTypes.SELECT });
                lessonsCount = parseInt(lessonsResult?.count || 0);
            } catch (err) {
                // Fallback to old hierarchy (lessons -> topics -> modules)
                const [lessonsResult] = await sequelize.query(`
                    SELECT COUNT(DISTINCT l.id) as count 
                    FROM lessons l
                    JOIN topics t ON l.topic_id = t.id
                    JOIN modules m ON t.module_id = m.id
                    WHERE m.course_id = :courseId
                `, { replacements: { courseId }, type: sequelize.QueryTypes.SELECT });
                lessonsCount = parseInt(lessonsResult?.count || 0);
            }

            // Count Quizzes
            let quizzesCount = 0;
            try {
                // Try direct course_id query
                quizzesCount = await Quiz.count({ where: { course_id: courseId } });
            } catch (err) {
                const [quizzesResult] = await sequelize.query(`
                    SELECT COUNT(DISTINCT q.id) as count 
                    FROM quizzes q
                    JOIN topics t ON q.topic_id = t.id
                    JOIN modules m ON t.module_id = m.id
                    WHERE m.course_id = :courseId
                `, { replacements: { courseId }, type: sequelize.QueryTypes.SELECT });
                quizzesCount = parseInt(quizzesResult?.count || 0);
            }

            // Count Assignments (Assignments are directly linked to Courses)
            const assignmentsCount = await Assignment.count({ where: { course_id: courseId } });

            const total = lessonsCount + quizzesCount + assignmentsCount;
            
            return total;
        } catch (error) {
            return 0;
        }
    }

    async detectCurrentModule(batch) {
        // Implementation for current module detection
        // Find module with highest completion % but not 100%
        const modules = await Module.findAll({ 
            where: { course_id: batch.course_id },
            order: [['order_num', 'ASC']]
        });

        if (!modules.length) return null;

        // Simplified: return the first module that is not fully completed by all students
        // Or just the first module if none started.
        return modules[0].name; 
    }

    async getFilterOptions(institutionId, filters = null) {
        const whereClause = { institution_id: institutionId, department: { [Op.ne]: null } };
        
        if (filters) {
            whereClause.department = { [Op.iLike]: `%${filters}%` };
        }

        const departments = await Batch.findAll({
            where: whereClause,
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('department')), 'department']],
            raw: true
        });

        return {
            departments: departments.map(d => d.department).filter(Boolean)
        };
    }

    getInitials(name) {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }

    getAvatarColor(name) {
        const colors = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
        if (!name) return colors[0];
        const index = name.length % colors.length;
        return colors[index];
    }

    /**
     * Get summary stats for the Batch Management page
     * @param {number} institutionId
     */
    async getBatchStats(institutionId) {
        // Card 1 — Total Batches: Count of all batches where institution_id matches AND status = 'active'
        const totalBatches = await Batch.count({
            where: {
                institution_id: institutionId,
                status: 'active'
            }
        });

        // Fetch all batches for this institution to use in other calculations
        const batches = await Batch.findAll({
            where: { institution_id: institutionId },
            attributes: ['id', 'course_id']
        });
        const batchIds = batches.map(b => b.id);

        // Card 2 — Active Students: Count of distinct active students enrolled across all batches of this institution
        let activeStudents = 0;
        if (batchIds.length > 0) {
            activeStudents = await Enrollment.count({
                distinct: true,
                col: 'student_id',
                where: {
                    batch_id: { [Op.in]: batchIds },
                    status: 'active'
                }
            });
        }

        // Card 3 — Avg Progress: Average of all batch progress values across all batches in this institution, rounded to whole number
        let totalProgressSum = 0;
        let validBatchesCount = 0;

        for (const batch of batches) {
            // Get all enrollments for this batch
            const enrollments = await Enrollment.findAll({
                where: { batch_id: batch.id },
                attributes: ['id']
            });

            // If a batch has zero students, exclude it from the avg_progress calculation
            if (enrollments.length === 0) {
                continue;
            }

            const enrollmentIds = enrollments.map(e => e.id);
            const courseId = batch.course_id;

            // Get total lessons in the course
            let lessonsCount = 0;
            if (courseId) {
                try {
                    // Try refactored hierarchy (lessons -> modules)
                    const [lessonsResult] = await sequelize.query(`
                        SELECT COUNT(DISTINCT l.id) as count 
                        FROM lessons l
                        JOIN modules m ON l.module_id = m.id
                        WHERE m.course_id = :courseId
                    `, { replacements: { courseId }, type: sequelize.QueryTypes.SELECT });
                    lessonsCount = parseInt(lessonsResult?.count || 0);
                } catch (err) {
                    try {
                        // Fallback to old hierarchy (lessons -> topics -> modules)
                        const [lessonsResult] = await sequelize.query(`
                            SELECT COUNT(DISTINCT l.id) as count 
                            FROM lessons l
                            JOIN topics t ON l.topic_id = t.id
                            JOIN modules m ON t.module_id = m.id
                            WHERE m.course_id = :courseId
                        `, { replacements: { courseId }, type: sequelize.QueryTypes.SELECT });
                        lessonsCount = parseInt(lessonsResult?.count || 0);
                    } catch (e) {
                        lessonsCount = 0;
                    }
                }
            }

            if (lessonsCount > 0) {
                const totalPossible = lessonsCount * enrollments.length;
                const completedLessons = await LessonProgress.count({
                    where: {
                        enrollment_id: { [Op.in]: enrollmentIds },
                        is_completed: true
                    }
                });
                const progress = (completedLessons / totalPossible) * 100;
                totalProgressSum += progress;
            } else {
                totalProgressSum += 0;
            }
            validBatchesCount++;
        }

        const avgProgressPercent = validBatchesCount > 0
            ? Math.round(totalProgressSum / validBatchesCount)
            : 0;

        // Card 4 — At-Risk Students: Count of distinct students across all batches in this institution where attendance_percent < 75 OR avg_quiz_score < 60
        let atRiskStudents = 0;
        if (batchIds.length > 0) {
            // Fetch all enrollments with their submissions and attendance for calculation
            const enrollments = await Enrollment.findAll({
                where: { batch_id: { [Op.in]: batchIds } },
                include: [
                    { 
                        model: QuizSubmission, 
                        include: [{ model: Quiz, attributes: ['total_marks'] }] 
                    },
                    { model: StudentAttendance, as: 'attendances' }
                ]
            });

            // Get total sessions per batch for attendance calculation
            const batchSessions = await AttendanceSession.findAll({
                where: { batch_id: { [Op.in]: batchIds } },
                attributes: ['batch_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                group: ['batch_id'],
                raw: true
            });
            
            const batchSessionMap = {};
            batchSessions.forEach(s => {
                batchSessionMap[s.batch_id] = parseInt(s.count);
            });

            const atRiskStudentIds = new Set();

            enrollments.forEach(e => {
                // Student Avg Quiz Score
                let studentAvgScore = 0;
                if (e.QuizSubmissions && e.QuizSubmissions.length > 0) {
                    let totalPct = 0;
                    e.QuizSubmissions.forEach(sub => {
                        const score = parseFloat(sub.score) || 0;
                        const maxMarks = (sub.Quiz && sub.Quiz.total_marks) ? parseFloat(sub.Quiz.total_marks) : 100;
                        totalPct += (score / maxMarks) * 100;
                    });
                    studentAvgScore = totalPct / e.QuizSubmissions.length;
                } else {
                    studentAvgScore = 0;
                }

                // Student Attendance Percent
                let attendancePct = 0;
                const totalBatchSessions = batchSessionMap[e.batch_id] || 0;
                if (totalBatchSessions > 0) {
                    const presentCount = e.attendances ? e.attendances.filter(a => a.status === 'present' || a.status === 'late').length : 0;
                    attendancePct = (presentCount / totalBatchSessions) * 100;
                } else {
                    attendancePct = 0; 
                }

                if (studentAvgScore < 60 || attendancePct < 75) {
                    atRiskStudentIds.add(e.student_id);
                }
            });

            atRiskStudents = atRiskStudentIds.size;
        }

        return {
            total_batches: totalBatches,
            active_students: activeStudents,
            avg_progress_percent: avgProgressPercent,
            at_risk_students: atRiskStudents
        };
    }
}

module.exports = new InstitutionRepBatchService();
