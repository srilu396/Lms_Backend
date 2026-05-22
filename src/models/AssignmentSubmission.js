module.exports = (sequelize, DataTypes) => {
    const AssignmentSubmission = sequelize.define('AssignmentSubmission', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        student_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        assignment_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'assignments',
                key: 'id'
            }
        },
        enrollment_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'enrollments',
                key: 'id'
            }
        },
        file_url: DataTypes.STRING,
        submission_data: {
            type: DataTypes.JSON,
            allowNull: true
        },
        grade: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true
        },
        feedback: DataTypes.TEXT,
        status: {
            type: DataTypes.ENUM('pending', 'submitted', 'graded', 'resubmit_requested'),
            defaultValue: 'pending'
        },
        submitted_at: DataTypes.DATE,
        graded_at: DataTypes.DATE
    }, {
        tableName: 'assignment_submissions',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false
    });

    AssignmentSubmission.associate = (models) => {
        AssignmentSubmission.belongsTo(models.User, { foreignKey: 'student_id' });
        AssignmentSubmission.belongsTo(models.Assignment, { foreignKey: 'assignment_id' });
        AssignmentSubmission.belongsTo(models.Enrollment, { foreignKey: 'enrollment_id' });
    };

    return AssignmentSubmission;
};
