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

        const courseIds = [...new Set(batches.map(b => b.course_id))];
        const batchIds = batches.map(b => b.id);

        const formattedBatches = [];

        if (batchIds.length > 0) {
            const [enrollments, courseItemsMap] = await Promise.all([
                Enrollment.findAll({
                    where: { batch_id: { [Op.in]: batchIds } },
                    attributes: ['id', 'student_id', 'batch_id'],
                    raw: true
                }),
                this.getBatchTotalItemsInCourses(courseIds)
            ]);

            const enrollmentsByBatch = {};
            enrollments.forEach(e => {
                if (!enrollmentsByBatch[e.batch_id]) {
                    enrollmentsByBatch[e.batch_id] = [];
                }
                enrollmentsByBatch[e.batch_id].push(e);
            });

            const enrollmentIds = enrollments.map(e => e.id);
            
            let completionsMap = {};
            if (enrollmentIds.length > 0) {
                const [lessonsCounts, assignmentsCounts, quizzesCounts] = await Promise.all([
                    LessonProgress.findAll({
                        attributes: ['enrollment_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                        where: { enrollment_id: { [Op.in]: enrollmentIds }, is_completed: true },
                        group: ['enrollment_id'],
                        raw: true
                    }),
                    AssignmentSubmission.findAll({
                        attributes: ['enrollment_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                        where: { enrollment_id: { [Op.in]: enrollmentIds }, status: { [Op.in]: ['submitted', 'graded'] } },
                        group: ['enrollment_id'],
                        raw: true
                    }),
                    QuizSubmission.findAll({
                        attributes: ['enrollment_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                        where: { enrollment_id: { [Op.in]: enrollmentIds }, status: { [Op.in]: ['completed', 'reviewed'] } },
                        group: ['enrollment_id'],
                        raw: true
                    })
                ]);

                lessonsCounts.forEach(c => {
                    completionsMap[c.enrollment_id] = (completionsMap[c.enrollment_id] || 0) + (parseInt(c.count) || 0);
                });
                assignmentsCounts.forEach(c => {
                    completionsMap[c.enrollment_id] = (completionsMap[c.enrollment_id] || 0) + (parseInt(c.count) || 0);
                });
                quizzesCounts.forEach(c => {
                    completionsMap[c.enrollment_id] = (completionsMap[c.enrollment_id] || 0) + (parseInt(c.count) || 0);
                });
            }

            for (const batch of batches) {
                const batchEnrollments = enrollmentsByBatch[batch.id] || [];
                const studentIds = batchEnrollments.map(e => e.student_id);
                
                let progressPercentage = 0;
                let progressStatus = 'upcoming';

                if (studentIds.length > 0) {
                    const totalItemsInCourse = courseItemsMap[batch.course_id] || 0;
                    if (totalItemsInCourse > 0) {
                        let totalCompletions = 0;
                        batchEnrollments.forEach(e => {
                            totalCompletions += completionsMap[e.id] || 0;
                        });

                        const maxPossibleCompletions = totalItemsInCourse * studentIds.length;
                        progressPercentage = Math.round((totalCompletions / maxPossibleCompletions) * 100);

                        if (progressPercentage === 100) {
                            progressStatus = 'completed';
                        } else {
                            const today = new Date();
                            const start = new Date(batch.start_date);
                            const end = new Date(batch.end_date);
                            
                            if (today < start) {
                                progressStatus = 'upcoming';
                            } else if (today > end) {
                                progressStatus = 'at_risk';
                            } else {
                                const totalDuration = end - start;
                                const elapsed = today - start;
                                const expectedProgress = (elapsed / totalDuration) * 100;

                                if (progressPercentage < expectedProgress - 10 || progressPercentage < 60) {
                                    progressStatus = 'at_risk';
                                } else {
                                    progressStatus = 'on_track';
                                }
                            }
                        }
                    } else {
                        progressStatus = 'on_track';
                    }
                }

                formattedBatches.push({
                    id: batch.id,
                    batch_id: `#BATCH-${batch.id}`,
                    batch_name: batch.name,
                    institution_name: batch.Institution?.name || 'N/A',
                    tutor: (batch.tutors && batch.tutors.length > 0) ? batch.tutors.map(t => t.full_name).join(', ') : 'Unassigned',
                    course: batch.Course?.name || 'N/A',
                    department: batch.department || 'Design',
                    start_date: batch.start_date,
                    status: batch.status,
                    total_students: studentIds.length,
                    progress_percentage: progressPercentage,
                    progress_status: progressStatus
                });
            }
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

    async getBatchTotalItemsInCourses(courseIds) {
        if (!courseIds.length) return {};
        
        try {
            const [lessonsResults, quizzesResults, assignmentsCounts] = await Promise.all([
                sequelize.query(`
                    SELECT m.course_id, COUNT(DISTINCT l.id) as count 
                    FROM lessons l
                    JOIN topics t ON l.topic_id = t.id
                    JOIN modules m ON t.module_id = m.id
                    WHERE m.course_id IN (:courseIds)
                    GROUP BY m.course_id
                `, { replacements: { courseIds }, type: sequelize.QueryTypes.SELECT }),
                
                sequelize.query(`
                    SELECT m.course_id, COUNT(DISTINCT q.id) as count 
                    FROM quizzes q
                    JOIN topics t ON q.topic_id = t.id
                    JOIN modules m ON t.module_id = m.id
                    WHERE m.course_id IN (:courseIds)
                    GROUP BY m.course_id
                `, { replacements: { courseIds }, type: sequelize.QueryTypes.SELECT }),
                
                Assignment.findAll({
                    attributes: ['course_id', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
                    where: { course_id: { [Op.in]: courseIds } },
                    group: ['course_id'],
                    raw: true
                })
            ]);

            const courseItemsMap = {};
            
            courseIds.forEach(cid => {
                courseItemsMap[cid] = 0;
            });

            lessonsResults.forEach(r => {
                courseItemsMap[r.course_id] = (courseItemsMap[r.course_id] || 0) + parseInt(r.count || 0, 10);
            });

            quizzesResults.forEach(r => {
                courseItemsMap[r.course_id] = (courseItemsMap[r.course_id] || 0) + parseInt(r.count || 0, 10);
            });

            assignmentsCounts.forEach(r => {
                courseItemsMap[r.course_id] = (courseItemsMap[r.course_id] || 0) + parseInt(r.count || 0, 10);
            });

            return courseItemsMap;
        } catch (error) {
            return {};
        }
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
            const [lessonsResult] = await sequelize.query(`
                SELECT COUNT(DISTINCT l.id) as count 
                FROM lessons l
                JOIN topics t ON l.topic_id = t.id
                JOIN modules m ON t.module_id = m.id
                WHERE m.course_id = :courseId
            `, { replacements: { courseId }, type: sequelize.QueryTypes.SELECT });

            // Count Quizzes
            const [quizzesResult] = await sequelize.query(`
                SELECT COUNT(DISTINCT q.id) as count 
                FROM quizzes q
                JOIN topics t ON q.topic_id = t.id
                JOIN modules m ON t.module_id = m.id
                WHERE m.course_id = :courseId
            `, { replacements: { courseId }, type: sequelize.QueryTypes.SELECT });

            // Count Assignments (Assignments are directly linked to Courses)
            const assignmentsCount = await Assignment.count({ where: { course_id: courseId } });

            const total = parseInt(lessonsResult.count || 0) + 
                          parseInt(quizzesResult.count || 0) + 
                          assignmentsCount;
            
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
}

module.exports = new InstitutionRepBatchService();
