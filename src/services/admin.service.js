const { Institution, Batch, Course, Tutor } = require('../models');

class AdminService {
    async getDashboardStats() {
        const [total_institutions, total_batches, total_courses, total_tutors] = await Promise.all([
            Institution.count({ where: { deleted_at: null } }),
            Batch.count({ where: { deleted_at: null } }),
            Course.count({ where: { deleted_at: null } }),
            Tutor.count({ where: { deleted_at: null } })
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
