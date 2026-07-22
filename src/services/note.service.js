const models = require('../models');
const { Note, Enrollment, Batch, Course, Module, Lesson, Topic, User, Student } = models;

class NoteService {
    async _checkEnrollment(userId, courseId) {
        const user = await User.findByPk(userId, { attributes: ['email'] });
        if (!user) throw { statusCode: 401, message: 'User not found' };

        const student = await Student.findOne({ where: { email: user.email } });
        if (!student) throw { statusCode: 404, message: 'Student profile not found for this account' };

        const enrollment = await Enrollment.findOne({
            include: [{ model: Batch, where: { course_id: courseId }, required: true }],
            where: { student_id: student.id, status: 'active' }
        });
        if (!enrollment) {
            throw { statusCode: 403, message: 'Access denied. You are not enrolled in this course.' };
        }
        return enrollment;
    }

    async getNote(userId, { courseId, moduleId = null, lessonId = null, topicId = null }) {
        await this._checkEnrollment(userId, courseId);
        
        // Always include basic fields
        const attributes = ['id', 'student_id', 'title', 'content'];
        
        // Only include the ID of the specific level being requested
        if (topicId) {
            attributes.push('topic_id');
        } else if (lessonId) {
            attributes.push('lesson_id');
        } else if (moduleId) {
            attributes.push('module_id');
        } else {
            attributes.push('course_id');
        }

        return await Note.findOne({
            where: { 
                student_id: userId, 
                course_id: courseId,
                module_id: moduleId,
                lesson_id: lessonId,
                topic_id: topicId
            },
            attributes
        });
    }

    async saveNote(userId, { courseId, moduleId = null, lessonId = null, topicId = null }, data) {
        await this._checkEnrollment(userId, courseId);

        // Validate that the requested course exists
        const course = await Course.findByPk(courseId);
        if (!course) throw { statusCode: 404, message: 'Course not found.' };

        // Validate lower level entities if provided
        if (moduleId) {
            const mod = await Module.findOne({ where: { id: moduleId, course_id: courseId } });
            if (!mod) throw { statusCode: 404, message: 'Module not found or does not belong to this course.' };
        }
        if (lessonId) {
            const lesson = await Lesson.findByPk(lessonId, {
                include: [{ model: Module, where: { course_id: courseId } }]
            });
            if (!lesson || !lesson.Module) {
                throw { statusCode: 404, message: 'Lesson not found or does not belong to this course.' };
            }
        }
        if (topicId) {
            const topic = await Topic.findByPk(topicId, {
                include: [{ model: Lesson, include: [{ model: Module, where: { course_id: courseId } }] }]
            });
            if (!topic || !topic.Lesson || !topic.Lesson.Module) {
                throw { statusCode: 404, message: 'Topic not found or does not belong to this course.' };
            }
        }

        const { title, content, timestamp, type } = data;

        const [note, created] = await Note.findOrCreate({
            where: {
                student_id: userId,
                course_id: courseId,
                module_id: moduleId,
                lesson_id: lessonId,
                topic_id: topicId
            },
            defaults: {
                title: title || null,
                content,
                timestamp: timestamp || null,
                type: type || 'general'
            }
        });

        if (!created) {
            await note.update({
                title: title !== undefined ? title : note.title,
                content: content !== undefined ? content : note.content,
                timestamp: timestamp !== undefined ? timestamp : note.timestamp,
                type: type !== undefined ? type : note.type
            });
        }

        // Return the clean version by re-fetching through getNote
        return await this.getNote(userId, { courseId, moduleId, lessonId, topicId });
    }
}

module.exports = new NoteService();
