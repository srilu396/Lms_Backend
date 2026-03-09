module.exports = (sequelize, DataTypes) => {
    const Enrollment = sequelize.define('Enrollment', {
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
        batch_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'batches',
                key: 'id'
            }
        },
        enrollment_date: {
            type: DataTypes.DATEONLY,
            defaultValue: DataTypes.NOW
        },
        status: {
            type: DataTypes.ENUM('active', 'completed', 'dropped'),
            defaultValue: 'active'
        }
    }, {
        tableName: 'enrollments',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                unique: true,
                fields: ['student_id', 'batch_id']
            }
        ]
    });

    Enrollment.associate = (models) => {
        Enrollment.belongsTo(models.User, { foreignKey: 'student_id' });
        Enrollment.belongsTo(models.Batch, { foreignKey: 'batch_id' });
        Enrollment.hasMany(models.QuizSubmission, { foreignKey: 'enrollment_id' });
        Enrollment.hasMany(models.AssignmentSubmission, { foreignKey: 'enrollment_id' });
        Enrollment.hasMany(models.StudentProgress, { foreignKey: 'enrollment_id' });
        Enrollment.hasMany(models.LessonProgress, { foreignKey: 'enrollment_id' });
        Enrollment.hasMany(models.StudentAttendance, { foreignKey: 'enrollment_id' });
        Enrollment.hasMany(models.StudentRiskReport, { foreignKey: 'enrollment_id' });
    };

    return Enrollment;
};
