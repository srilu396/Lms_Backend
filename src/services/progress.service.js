const { LessonProgress, StudentProgress, TopicProgress, Lesson, Topic, Module, Course, Enrollment, Batch, sequelize } = require('../models');

class ProgressService {
    /**
     * Update progress for a specific module
     */
    async updateModuleProgress(studentId, enrollmentId, moduleId, data) {
        // Find if the module exists
        const module = await Module.findByPk(moduleId);
        if (!module) {
            const error = new Error('Module not found');
            error.statusCode = 404;
            throw error;
        }

        // Verify enrollment
        const user = await require('../models').User.findByPk(studentId);
        const enrollment = await Enrollment.findOne({
            where: { id: enrollmentId },
            include: [{
                model: require('../models').Student,
                as: 'student',
                where: { email: user.email }
            }]
        });

        if (!enrollment) {
            const error = new Error('Enrollment not found or unauthorized');
            error.statusCode = 404;
            throw error;
        }

        // Upsert module progress
        const result = await sequelize.transaction(async (t) => {
            let [studentProgress, created] = await StudentProgress.findOrCreate({
                where: { student_id: studentId, module_id: moduleId, enrollment_id: enrollmentId },
                defaults: {
                    progress_pct: data.is_completed ? 100 : 0,
                    is_completed: data.is_completed || false,
                    last_accessed: new Date()
                },
                transaction: t
            });

            if (!created) {
                studentProgress.progress_pct = data.is_completed ? 100 : studentProgress.progress_pct;
                studentProgress.is_completed = data.is_completed !== undefined ? data.is_completed : studentProgress.is_completed;
                studentProgress.last_accessed = new Date();
                await studentProgress.save({ transaction: t });
            }

            return studentProgress;
        });

        return result;
    }

    /**
     * Update progress for a specific lesson
     */
    async updateLessonProgress(studentId, enrollmentId, lessonId, data) {
        // Find if the lesson exists
        const lesson = await Lesson.findByPk(lessonId, {
            include: [{ model: Module }]
        });

        if (!lesson) {
            const error = new Error('Lesson not found');
            error.statusCode = 404;
            throw error;
        }

        // Verify enrollment
        const user = await require('../models').User.findByPk(studentId);
        const enrollment = await Enrollment.findOne({
            where: { id: enrollmentId },
            include: [{
                model: require('../models').Student,
                as: 'student',
                where: { email: user.email }
            }]
        });

        if (!enrollment) {
            const error = new Error('Enrollment not found or unauthorized');
            error.statusCode = 404;
            throw error;
        }

        // Upsert lesson progress
        const result = await sequelize.transaction(async (t) => {
            let [lessonProgress, created] = await LessonProgress.findOrCreate({
                where: { student_id: studentId, lesson_id: lessonId, enrollment_id: enrollmentId },
                defaults: {
                    is_completed: data.is_completed || false,
                    video_watch_pct: data.video_watch_pct || 0.00,
                    completed_at: data.is_completed ? new Date() : null,
                    last_accessed: new Date()
                },
                transaction: t
            });

            if (!created) {
                lessonProgress.is_completed = data.is_completed !== undefined ? data.is_completed : lessonProgress.is_completed;
                lessonProgress.video_watch_pct = data.video_watch_pct !== undefined ? data.video_watch_pct : lessonProgress.video_watch_pct;
                lessonProgress.last_accessed = new Date();
                
                if (lessonProgress.is_completed && !lessonProgress.completed_at) {
                    lessonProgress.completed_at = new Date();
                } else if (!lessonProgress.is_completed) {
                    lessonProgress.completed_at = null;
                }

                await lessonProgress.save({ transaction: t });
            }

            return lessonProgress;
        });

        return result;
    }

    /**
     * Update progress for a specific topic
     */
    async updateTopicProgress(studentId, enrollmentId, topicId, data) {
        // Find if the topic exists
        const topic = await Topic.findByPk(topicId);
        if (!topic) {
            const error = new Error('Topic not found');
            error.statusCode = 404;
            throw error;
        }

        // Verify enrollment
        const user = await require('../models').User.findByPk(studentId);
        const enrollment = await Enrollment.findOne({
            where: { id: enrollmentId },
            include: [{
                model: require('../models').Student,
                as: 'student',
                where: { email: user.email }
            }]
        });

        if (!enrollment) {
            const error = new Error('Enrollment not found or unauthorized');
            error.statusCode = 404;
            throw error;
        }

        // Upsert topic progress
        const result = await sequelize.transaction(async (t) => {
            let [topicProgress, created] = await TopicProgress.findOrCreate({
                where: { student_id: studentId, topic_id: topicId, enrollment_id: enrollmentId },
                defaults: {
                    is_completed: data.is_completed || false,
                    completed_at: data.is_completed ? new Date() : null,
                    last_accessed: new Date()
                },
                transaction: t
            });

            if (!created) {
                topicProgress.is_completed = data.is_completed !== undefined ? data.is_completed : topicProgress.is_completed;
                topicProgress.last_accessed = new Date();
                
                if (topicProgress.is_completed && !topicProgress.completed_at) {
                    topicProgress.completed_at = new Date();
                } else if (!topicProgress.is_completed) {
                    topicProgress.completed_at = null;
                }

                await topicProgress.save({ transaction: t });
            }

            return topicProgress;
        });

        return result;
    }

    /**
     * Get course progress summary for a student enrollment
     */
    async getCourseProgressSummary(studentId, enrollmentId) {
        // Verify enrollment
        const user = await require('../models').User.findByPk(studentId);
        
        const enrollment = await Enrollment.findOne({
            where: { id: enrollmentId },
            include: [
                {
                    model: require('../models').Student,
                    as: 'student',
                    where: { email: user.email }
                },
                {
                    model: Batch,
                    include: [{ model: Course }]
                }
            ]
        });

        if (!enrollment) {
            const error = new Error('Enrollment not found or unauthorized');
            error.statusCode = 404;
            throw error;
        }

        const courseId = enrollment.Batch.course_id;

        // Get all modules in the course
        const modules = await Module.findAll({
            where: { course_id: courseId },
            attributes: ['id', 'name', 'order_num']
        });

        // Initialize progress stats
        let overallProgressPct = 0;
        let modulesSummary = [];

        if (modules.length > 0) {
            const moduleIds = modules.map(m => m.id);

            // Get student progress for these modules
            const moduleProgresses = await StudentProgress.findAll({
                where: { student_id: studentId, enrollment_id: enrollmentId, module_id: moduleIds }
            });

            const progressMap = {};
            let totalProgressPct = 0;

            moduleProgresses.forEach(mp => {
                progressMap[mp.module_id] = mp;
                totalProgressPct += parseFloat(mp.progress_pct);
            });

            overallProgressPct = totalProgressPct / modules.length;

            modulesSummary = modules.map(mod => {
                const mp = progressMap[mod.id];
                return {
                    module_id: mod.id,
                    module_name: mod.name,
                    order_num: mod.order_num,
                    progress_pct: mp ? parseFloat(mp.progress_pct) : 0,
                    is_completed: mp ? mp.is_completed : false,
                    last_accessed: mp ? mp.last_accessed : null
                };
            }).sort((a, b) => a.order_num - b.order_num);
        }

        return {
            course_id: courseId,
            enrollment_id: parseInt(enrollmentId, 10),
            course_name: enrollment.Batch.Course ? enrollment.Batch.Course.name : null,
            overall_progress_pct: parseFloat(overallProgressPct.toFixed(2)),
            modules: modulesSummary
        };
    }
}

module.exports = new ProgressService();
