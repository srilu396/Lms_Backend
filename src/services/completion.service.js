const models = require('../models');
const { Op } = require('sequelize');

class CompletionService {

    async _getStudentByUserId(userId) {
        const user = await models.User.findByPk(userId, { attributes: ['email'] });
        if (!user) throw { statusCode: 401, message: 'User not found' };

        const student = await models.Student.findOne({ where: { email: user.email } });
        if (!student) throw { statusCode: 404, message: 'Student profile not found for this account' };

        return student;
    }

    async getCompletedContent(userId, courseId, contentType, filters = {}) {
        const student = await this._getStudentByUserId(userId);

        const enrollment = await models.Enrollment.findOne({
            include: [{
                model: models.Batch,
                where: { course_id: courseId },
                required: true
            }],
            where: { student_id: student.id, status: 'active' }
        });

        if (!enrollment) throw { statusCode: 403, message: 'Access denied. You are not enrolled in this course.' };

        const { page = 1, limit = 10, search = '', filter = '' } = filters;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        // Fetch entire course structure to compute locks and associations
        // CORRECTED HIERARCHY: Module -> Lesson -> Topic
        const course = await models.Course.findByPk(courseId, {
            attributes: ['id', 'name'],
            include: [
                {
                    model: models.Module,
                    as: 'modules',
                    attributes: ['id', 'name', 'order_num'],
                    order: [['order_num', 'ASC']],
                    include: [
                        {
                            model: models.Lesson,
                            as: 'lessons',
                            attributes: ['id', 'name', 'order_num'],
                            order: [['order_num', 'ASC']],
                            include: [
                                {
                                    model: models.Topic,
                                    as: 'topics',
                                    attributes: ['id', 'name', 'order_num'],
                                    order: [['order_num', 'ASC']]
                                },
                                { model: models.Quiz, as: 'quizzes', attributes: ['id', 'name'] },
                                { model: models.Assignment, as: 'assignments', attributes: ['id', 'title'] }
                            ]
                        },
                        { model: models.Quiz, as: 'quizzes', attributes: ['id', 'name'] },
                        { model: models.Assignment, as: 'assignments', attributes: ['id', 'title'] }
                    ]
                }
            ]
        });

        if (!course) throw { statusCode: 404, message: 'Course not found' };
        if (!course.modules) course.modules = [];

        // Fetch Progress Data
        const allModuleIds = course.modules.map(m => m.id);
        const allLessonIds = [];
        course.modules.forEach(m => {
            if (m.lessons) m.lessons.forEach(l => allLessonIds.push(l.id));
        });

        const studentProgresses = await models.StudentProgress.findAll({
            where: { enrollment_id: enrollment.id, module_id: { [Op.in]: allModuleIds } }
        });
        const modProgressMap = new Map();
        studentProgresses.forEach(sp => modProgressMap.set(sp.module_id, sp));

        const lessonProgresses = await models.LessonProgress.findAll({
            where: { enrollment_id: enrollment.id, lesson_id: { [Op.in]: allLessonIds } }
        });
        const lesProgressMap = new Map();
        lessonProgresses.forEach(lp => lesProgressMap.set(lp.lesson_id, lp));

        const quizIds = [];
        const assignmentIds = [];
        course.modules.forEach(m => {
            if (m.quizzes) m.quizzes.forEach(q => quizIds.push(q.id));
            if (m.assignments) m.assignments.forEach(a => assignmentIds.push(a.id));
            if (m.lessons) m.lessons.forEach(l => {
                if (l.quizzes) l.quizzes.forEach(q => quizIds.push(q.id));
                if (l.assignments) l.assignments.forEach(a => assignmentIds.push(a.id));
            });
        });

        const quizSubmissions = await models.QuizSubmission.findAll({
            where: { student_id: student.id, quiz_id: { [Op.in]: quizIds } },
            order: [['submitted_at', 'DESC']]
        });
        const quizSubMap = new Map();
        quizSubmissions.forEach(qs => { if (!quizSubMap.has(qs.quiz_id)) quizSubMap.set(qs.quiz_id, qs); });

        const assignSubmissions = await models.AssignmentSubmission.findAll({
            where: { student_id: student.id, assignment_id: { [Op.in]: assignmentIds } },
            order: [['submitted_at', 'DESC']]
        });
        const assignSubMap = new Map();
        assignSubmissions.forEach(as => { if (!assignSubMap.has(as.assignment_id)) assignSubMap.set(as.assignment_id, as); });

        // Determine Unlocked Status for Modules
        let isPreviousModuleCompleted = true; // First module is always unlocked
        const unlockedModuleIds = new Set();
        
        course.modules.forEach(mod => {
            if (isPreviousModuleCompleted) {
                unlockedModuleIds.add(mod.id);
            }
            
            // Check if this module is fully completed to unlock the next one
            let modComplete = false;
            let totalLes = 0;
            let compLes = 0;
            if (mod.lessons) {
                mod.lessons.forEach(les => {
                    totalLes++;
                    if (lesProgressMap.has(les.id) && lesProgressMap.get(les.id).is_completed) {
                        compLes++;
                    }
                });
            }
            
            if (totalLes > 0 && compLes === totalLes) {
                modComplete = true;
            } else if (totalLes === 0) {
                const sp = modProgressMap.get(mod.id);
                if (sp && sp.is_completed) modComplete = true;
                else modComplete = true;
            }

            isPreviousModuleCompleted = modComplete;
        });

        // Collect Content Items
        let rawData = [];

        course.modules.forEach(mod => {
            if (!unlockedModuleIds.has(mod.id)) return; // Locked

            let modTotalLes = 0;
            let modCompLes = 0;
            if (mod.lessons) {
                mod.lessons.forEach(les => {
                    modTotalLes++;
                    if (lesProgressMap.has(les.id) && lesProgressMap.get(les.id).is_completed) {
                        modCompLes++;
                    }
                });
            }
            let modProgressPct = modTotalLes > 0 ? Math.round((modCompLes / modTotalLes) * 100) : 0;
            let modCompleted = modTotalLes > 0 ? (modProgressPct === 100) : (modProgressMap.has(mod.id) && modProgressMap.get(mod.id).is_completed);
            let modUpdatedAt = modProgressMap.has(mod.id) ? modProgressMap.get(mod.id).updated_at : new Date(0);

            if (contentType === 'modules') {
                rawData.push({
                    id: mod.id,
                    name: mod.name,
                    progress: modProgressPct,
                    status: modCompleted ? 'completed' : 'in_progress',
                    updated_at: modUpdatedAt
                });
            }

            if (mod.lessons) {
                mod.lessons.forEach(les => {
                    const lp = lesProgressMap.get(les.id);
                    let lesCompleted = lp ? lp.is_completed : false;
                    let lesProgressPct = lesCompleted ? 100 : (lp ? 50 : 0);
                    let lesUpdatedAt = lp ? lp.updated_at : new Date(0);

                    if (contentType === 'lessons') {
                        rawData.push({
                            id: les.id,
                            name: les.name,
                            progress: lesProgressPct,
                            status: lesCompleted ? 'completed' : 'in_progress',
                            updated_at: lesUpdatedAt
                        });
                    }

                    if (contentType === 'topics' && les.topics) {
                        les.topics.forEach(top => {
                            // Topic progress logic is derived from its parent lesson in this hierarchy
                            let topCompleted = lesCompleted;
                            let topProgressPct = lesProgressPct;
                            
                            rawData.push({
                                id: top.id,
                                name: top.name,
                                progress: topProgressPct,
                                status: topCompleted ? 'completed' : 'in_progress',
                                updated_at: lesUpdatedAt
                            });
                        });
                    }

                    if (contentType === 'quizzes' && les.quizzes) les.quizzes.forEach(q => processQuiz(q, quizSubMap, rawData));
                    if (contentType === 'assignments' && les.assignments) les.assignments.forEach(a => processAssignment(a, assignSubMap, rawData));
                });
            }
            
            if (contentType === 'quizzes' && mod.quizzes) mod.quizzes.forEach(q => processQuiz(q, quizSubMap, rawData));
            if (contentType === 'assignments' && mod.assignments) mod.assignments.forEach(a => processAssignment(a, assignSubMap, rawData));
        });

        function processQuiz(q, subMap, output) {
            const qs = subMap.get(q.id);
            const isCompleted = !!qs; 
            output.push({
                id: q.id,
                name: q.name,
                progress: isCompleted ? 100 : 0,
                status: isCompleted ? 'completed' : 'in_progress',
                updated_at: qs ? qs.submitted_at : new Date(0)
            });
        }

        function processAssignment(a, subMap, output) {
            const asub = subMap.get(a.id);
            const isCompleted = !!asub; 
            output.push({
                id: a.id,
                name: a.title,
                progress: isCompleted ? 100 : 0,
                status: isCompleted ? 'completed' : 'in_progress',
                updated_at: asub ? asub.submitted_at : new Date(0)
            });
        }

        if (search) {
            rawData = rawData.filter(item => item.name && item.name.toLowerCase().includes(search.toLowerCase()));
        }
        
        if (filter === 'completed') {
            rawData = rawData.filter(item => item.status === 'completed');
        } else if (filter === 'in_progress') {
            rawData = rawData.filter(item => item.status === 'in_progress');
        }

        rawData.sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime());

        const totalItems = rawData.length;
        const pagedData = rawData.slice(offset, offset + parsedLimit);

        const finalData = pagedData.map(item => ({
            id: item.id,
            name: item.name,
            progress: item.progress,
            status: item.status,
            completed_at: item.updated_at.getTime() > 0 ? item.updated_at : null
        }));

        return {
            course_name: course.name,
            data: finalData,
            pagination: {
                total_items: totalItems,
                total_pages: Math.ceil(totalItems / parsedLimit),
                current_page: parsedPage,
                items_per_page: parsedLimit
            }
        };
    }
}

module.exports = new CompletionService();
