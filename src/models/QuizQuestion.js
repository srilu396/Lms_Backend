module.exports = (sequelize, DataTypes) => {
    const QuizQuestion = sequelize.define('QuizQuestion', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        quiz_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'quizzes',
                key: 'id'
            }
        },
        question_text: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        options: DataTypes.JSONB,
        correct_answer: DataTypes.STRING,
        type: {
            type: DataTypes.ENUM('mcq', 'short', 'true_false'),
            allowNull: false
        },
        marks: {
            type: DataTypes.INTEGER,
            defaultValue: 1
        },
        explanation: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        order_num: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'quiz_questions',
        timestamps: false
    });

    QuizQuestion.associate = (models) => {
        QuizQuestion.belongsTo(models.Quiz, { foreignKey: 'quiz_id' });
        QuizQuestion.hasMany(models.QuizAnswer, { foreignKey: 'question_id' });
    };

    return QuizQuestion;
};
