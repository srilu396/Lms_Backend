const { Institution, Batch, Course, Tutor } = require('../models');

class AdminService {
    async getDashboardStats() {
        const [total_institutions, total_batches, total_courses, total_tutors] = await Promise.all([
            Institution.count(),
            Batch.count(),
            Course.count(),
            Tutor.count()
        ]);

        return {
            total_institutions,
            total_batches,
            total_courses,
            total_tutors
        };
    }
}

module.exports = new AdminService();
