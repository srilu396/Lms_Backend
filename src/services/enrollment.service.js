const { Enrollment, Batch } = require('../models');

class EnrollmentService {
    async enrollStudent(data) {
        const batch = await Batch.findByPk(data.batch_id);
        if (!batch) {
            const error = new Error('Batch not found');
            error.statusCode = 404;
            throw error;
        }

        return await Enrollment.create(data);
    }
}

module.exports = new EnrollmentService();
