const { LessonProgress, StudentProgress, Lesson, Topic, Module, Course, Enrollment, Batch, sequelize } = require('../models');

class ProgressService {
    /**
     * Update progress for a specific lesson
     */
    async updateLessonProgress(studentId, enrollmentId, lessonId, data) {
        // Find if the lesson exists
        const lesson = await Lesson.findByPk(lessonId, {
            include: [{
                model: Topic,
                include: [{ model: Module }]
            }]
        });

        if (!lesson) {
            const error = new Error('Lesson not found');
            error.statusCode = 404;
            throw error;
        }

        // Verify enrollment
        const enrollment = await Enrollment.findOne({
            where: { id: enrollmentId, student_id: studentId }
        });

        if (!enrollment) {
            const error = new Error('Enrollment not found or unauthorized');
            error.statusCode = 404;
            throw error;
        }

        const moduleId = lesson.Topic.module_id;

        // Upsert lesson progress using a transaction
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

            // Recalculate module progress
            await this.recalculateModuleProgress(studentId, enrollmentId, moduleId, t);

            return lessonProgress;
        });

        return result;
    }

    /**
     * Recalculate StudentProgress for a module
     */
    async recalculateModuleProgress(studentId, enrollmentId, moduleId, t) {
        // Get all lessons in the module
        const moduleLessons = await Lesson.findAll({
            include: [{
                model: Topic,
                where: { module_id: moduleId },
                attributes: []
            }],
            transaction: t
        });

        const totalLessons = moduleLessons.length;

        if (totalLessons === 0) return;

        const lessonIds = moduleLessons.map(l => l.id);

        // Get completed lessons for this student in this module
        const completedLessonsCount = await LessonProgress.count({
            where: {
                student_id: studentId,
                enrollment_id: enrollmentId,
                lesson_id: lessonIds,
                is_completed: true
            },
            transaction: t
        });

        const progressPct = (completedLessonsCount / totalLessons) * 100;
        const isCompleted = completedLessonsCount === totalLessons;

        // Upsert StudentProgress for the module
        let [studentProgress, created] = await StudentProgress.findOrCreate({
            where: { student_id: studentId, module_id: moduleId, enrollment_id: enrollmentId },
            defaults: {
                progress_pct: progressPct,
                is_completed: isCompleted,
                last_accessed: new Date()
            },
            transaction: t
        });

        if (!created) {
            studentProgress.progress_pct = progressPct;
            studentProgress.is_completed = isCompleted;
            studentProgress.last_accessed = new Date();
            await studentProgress.save({ transaction: t });
        }
    }

    /**
     * Get course progress summary for a student enrollment
     */
    async getCourseProgressSummary(studentId, enrollmentId) {
        // Verify enrollment
        const enrollment = await Enrollment.findOne({
            where: { id: enrollmentId, student_id: studentId },
            include: [{
                model: Batch,
                include: [{ model: Course }]
            }]
        });

        if (!enrollment) {
            const error = new Error('Enrollment not found');
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
