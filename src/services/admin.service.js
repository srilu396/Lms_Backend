const { Batch, Course, Tutor } = require('../models');
const institutionService = require('./institution.service');

class AdminService {
    async getDashboardStats() {
        const [total_institutions, total_batches, total_courses, total_tutors] = await Promise.all([
            institutionService.getInstitutionCount(),
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
