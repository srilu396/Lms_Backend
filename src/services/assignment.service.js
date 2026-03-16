const db = require('../models');
const { Op } = require('sequelize');

class AssignmentService {
    async getAssignmentStats() {
        const totalAssignments = await db.Assignment.count();
        const activeAssignments = await db.Assignment.count({ where: { status: 'active' } });
        const pendingSubmissions = await db.AssignmentSubmission.count({ where: { status: 'pending' } });
        
        // Average score
        const averageScoreResult = await db.Assignment.findOne({
            attributes: [[db.sequelize.fn('AVG', db.sequelize.cast(db.sequelize.col('max_score'), 'double precision')), 'avgScore']]
        });
        const averageScore = averageScoreResult?.dataValues?.avgScore ? parseFloat(averageScoreResult.dataValues.avgScore).toFixed(2) : 0;

        return {
            totalAssignments,
            activeAssignments,
            submissionPendingAssignments: pendingSubmissions,
            averageScore: parseFloat(averageScore)
        };
    }

    async createAssignment(data) {
        const transaction = await db.sequelize.transaction();
        try {
            const { title, description, domains, tags, submission_type, instructions, max_score, course_id, evaluation_matrix, status } = data;

            // calculate max_score from evaluation_matrix if not provided
            let final_max_score = max_score;
            if (!final_max_score && evaluation_matrix && evaluation_matrix.length > 0) {
                final_max_score = evaluation_matrix.reduce((sum, item) => sum + (parseFloat(item.marks) || 0), 0);
            }

            const assignment = await db.Assignment.create({
                title,
                description,
                domains: domains || [],
                tags: tags || [],
                submission_type,
                instructions,
                max_score: final_max_score || 0,
                course_id,
                status: status || 'active'
            }, { transaction });

            if (evaluation_matrix && Array.isArray(evaluation_matrix) && evaluation_matrix.length > 0) {
                const criteriaData = evaluation_matrix.map(criteria => ({
                    assignment_id: assignment.id,
                    criteria_name: criteria.name,
                    max_points: criteria.marks,
                    description: criteria.description || ''
                }));
                await db.AssignmentCriteria.bulkCreate(criteriaData, { transaction });
            }

            await transaction.commit();
            return await this.getAssignmentById(assignment.id);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async getAllAssignments(queryParams) {
        let { page = 1, limit = 10, search, submission_type, sort_by = 'created_at', sort_order = 'DESC' } = queryParams;
        page = parseInt(page);
        limit = parseInt(limit);
        const offset = (page - 1) * limit;

        const where = {};
        if (search) {
            where.title = { [Op.iLike]: `%${search}%` };
        }
        if (submission_type) {
            where.submission_type = submission_type;
        }

        const { count, rows } = await db.Assignment.findAndCountAll({
            where,
            include: [{
                model: db.AssignmentCriteria,
                as: 'evaluation_matrix',
                attributes: ['id', 'criteria_name', 'max_points', 'description']
            }],
            limit,
            offset,
            order: [[sort_by, sort_order]]
        });

        // formatting as per requirements
        const formattedRows = rows.map(row => {
            const assignment = row.toJSON();
            return {
                assignment_id: assignment.id,
                assignment_name: assignment.title,
                course: null, // explicitly requested to be null
                domains: assignment.domains,
                tags: assignment.tags,
                marks: assignment.max_score,
                submission_type: assignment.submission_type,
                status: assignment.status,
                created_at: assignment.created_at
            };
        });

        return {
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
            data: formattedRows
        };
    }

    async getAssignmentById(id) {
        const assignment = await db.Assignment.findByPk(id, {
            include: [{
                model: db.AssignmentCriteria,
                as: 'evaluation_matrix',
                attributes: ['id', 'criteria_name', 'max_points', 'description']
            }]
        });

        if (!assignment) {
            throw new Error('Assignment not found');
        }

        return assignment;
    }

    async updateAssignment(id, data) {
        const transaction = await db.sequelize.transaction();
        try {
            const assignment = await db.Assignment.findByPk(id);
            if (!assignment) {
                throw new Error('Assignment not found');
            }

            const { title, description, domains, tags, submission_type, instructions, max_score, course_id, evaluation_matrix, status } = data;

            let final_max_score = max_score !== undefined ? max_score : assignment.max_score;
            if (max_score === undefined && evaluation_matrix && Array.isArray(evaluation_matrix)) {
                final_max_score = evaluation_matrix.reduce((sum, item) => sum + (parseFloat(item.marks) || 0), 0);
            }

            await assignment.update({
                title: title !== undefined ? title : assignment.title,
                description: description !== undefined ? description : assignment.description,
                domains: domains !== undefined ? domains : assignment.domains,
                tags: tags !== undefined ? tags : assignment.tags,
                submission_type: submission_type !== undefined ? submission_type : assignment.submission_type,
                instructions: instructions !== undefined ? instructions : assignment.instructions,
                max_score: final_max_score,
                course_id: course_id !== undefined ? course_id : assignment.course_id,
                status: status !== undefined ? status : assignment.status
            }, { transaction });

            if (evaluation_matrix && Array.isArray(evaluation_matrix)) {
                // Remove old evaluation criteria
                await db.AssignmentCriteria.destroy({ where: { assignment_id: id }, transaction });
                
                // Add new evaluation criteria
                if (evaluation_matrix.length > 0) {
                    const criteriaData = evaluation_matrix.map(criteria => ({
                        assignment_id: id,
                        criteria_name: criteria.name,
                        max_points: criteria.marks,
                        description: criteria.description || ''
                    }));
                    await db.AssignmentCriteria.bulkCreate(criteriaData, { transaction });
                }
            }

            await transaction.commit();
            return await this.getAssignmentById(id);
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async deleteAssignment(id) {
        const transaction = await db.sequelize.transaction();
        try {
            const assignment = await db.Assignment.findByPk(id);
            if (!assignment) {
                throw new Error('Assignment not found');
            }

            // Rule: cannot delete if assigned to any batch
            const batchAssignedCount = await db.BatchAssignment.count({ where: { assignment_id: id } });
            if (batchAssignedCount > 0) {
                throw new Error('Cannot delete assignment as it has been assigned to a batch.');
            }

            await db.AssignmentCriteria.destroy({ where: { assignment_id: id }, transaction });
            await assignment.destroy({ transaction });

            await transaction.commit();
            return { message: 'Assignment deleted successfully' };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}

module.exports = new AssignmentService();
