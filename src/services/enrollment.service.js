const { Enrollment, Batch, Student, User, Course } = require('../models');

class EnrollmentService {
    async enrollStudent(data) {
        const batch = await Batch.findByPk(data.batch_id);
        if (!batch) {
            const error = new Error('Batch not found');
            error.statusCode = 404;
            throw error;
        }

        const student = await Student.findByPk(data.student_id);
        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        // Check if already enrolled
        const existingEnrollment = await Enrollment.findOne({
            where: { student_id: data.student_id, batch_id: data.batch_id }
        });
        if (existingEnrollment) {
            const error = new Error('Student is already enrolled in this batch');
            error.statusCode = 409;
            throw error;
        }

        const enrollment = await Enrollment.create(data);

        // --- NOTIFICATION TRIGGER 6 (Student Enrollment) ---
        try {
            if (student.user_id) {
                const { createNotification } = require('../notifications/notification.service');
                const courseName = batch.course_id ? (await Course.findByPk(batch.course_id))?.name || 'your course' : 'your course';
                await createNotification({
                    userId: student.user_id,
                    role: 'student',
                    type: 'BATCH_ALLOCATED_STUDENT',
                    title: 'You Have Been Enrolled in a Batch',
                    message: `You have been enrolled in "${batch.name}". Your course "${courseName}" starts on ${batch.start_date || 'soon'}. Welcome!`,
                    referenceId: batch.id,
                    referenceType: 'batch'
                });
            }
        } catch (err) {}
        // --- END NOTIFICATION TRIGGER ---

        return enrollment;
    }

    async getAllEnrollments(filters = {}) {
        const whereClause = {};
        if (filters.student_id) whereClause.student_id = filters.student_id;
        if (filters.batch_id) whereClause.batch_id = filters.batch_id;
        if (filters.status) whereClause.status = filters.status;

        return await Enrollment.findAll({
            where: whereClause,
            include: [
                {
                    model: Student,
                    as: 'student'
                },
                {
                    model: Batch,
                    include: [{ model: Course, attributes: ['id', 'name'] }]
                }
            ],
            order: [['created_at', 'DESC']]
        });
    }

    async getEnrollmentById(id) {
        const enrollment = await Enrollment.findByPk(id, {
            include: [
                {
                    model: Student,
                    as: 'student'
                },
                {
                    model: Batch,
                    include: [{ model: Course, attributes: ['id', 'name'] }]
                }
            ]
        });

        if (!enrollment) {
            const error = new Error('Enrollment not found');
            error.statusCode = 404;
            throw error;
        }

        return enrollment;
    }

    async updateEnrollmentStatus(id, status) {
        const validStatuses = ['active', 'completed', 'dropped'];
        if (!validStatuses.includes(status)) {
            const error = new Error('Invalid status');
            error.statusCode = 400;
            throw error;
        }

        const enrollment = await this.getEnrollmentById(id);
        enrollment.status = status;
        await enrollment.save();

        return enrollment;
    }

    async deleteEnrollment(id) {
        const enrollment = await Enrollment.findByPk(id);
        if (!enrollment) {
            const error = new Error('Enrollment not found');
            error.statusCode = 404;
            throw error;
        }

        await enrollment.destroy();
        return { message: 'Enrollment deleted successfully' };
    }
}

module.exports = new EnrollmentService();
