module.exports = (sequelize, DataTypes) => {
    const QuizSubmission = sequelize.define('QuizSubmission', {
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
        quiz_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'quizzes',
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
        attempt_number: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        score: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('pending_review', 'reviewed', 'completed'),
            defaultValue: 'completed'
        },
        submitted_at: DataTypes.DATE
    }, {
        tableName: 'quiz_submissions',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                unique: true,
                fields: ['student_id', 'quiz_id', 'enrollment_id', 'attempt_number']
            }
        ]
    });

    QuizSubmission.associate = (models) => {
        QuizSubmission.belongsTo(models.User, { foreignKey: 'student_id' });
        QuizSubmission.belongsTo(models.Quiz, { foreignKey: 'quiz_id' });
        QuizSubmission.belongsTo(models.Enrollment, { foreignKey: 'enrollment_id' });
        QuizSubmission.hasMany(models.QuizAnswer, { foreignKey: 'submission_id' });
    };

    return QuizSubmission;
};
