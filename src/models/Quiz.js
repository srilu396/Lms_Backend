module.exports = (sequelize, DataTypes) => {
    const Quiz = sequelize.define('Quiz', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        topic_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'topics',
                key: 'id'
            }
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        instructions: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        max_attempts: {
            type: DataTypes.INTEGER,
            defaultValue: 1
        },
        time_limit_minutes: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        passing_score: {
            type: DataTypes.INTEGER,
            allowNull: true
        }
    }, {
        tableName: 'quizzes',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false
    });

    Quiz.associate = (models) => {
        Quiz.belongsTo(models.Topic, { foreignKey: 'topic_id' });
        Quiz.hasMany(models.QuizQuestion, { foreignKey: 'quiz_id' });
        Quiz.hasMany(models.QuizSubmission, { foreignKey: 'quiz_id' });
    };

    return Quiz;
};
