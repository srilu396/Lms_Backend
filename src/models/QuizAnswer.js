module.exports = (sequelize, DataTypes) => {
    const QuizAnswer = sequelize.define('QuizAnswer', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        submission_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'quiz_submissions',
                key: 'id'
            }
        },
        question_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'quiz_questions',
                key: 'id'
            }
        },
        selected_answer: DataTypes.TEXT,
        is_correct: {
            type: DataTypes.BOOLEAN,
            allowNull: true // Might need grading for short answers
        },
        video_watch_pct: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true
        },
        answered_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'quiz_answers',
        timestamps: false
    });

    QuizAnswer.associate = (models) => {
        QuizAnswer.belongsTo(models.QuizSubmission, { foreignKey: 'submission_id' });
        QuizAnswer.belongsTo(models.QuizQuestion, { foreignKey: 'question_id' });
    };

    return QuizAnswer;
};
