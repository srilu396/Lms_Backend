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
            allowNull: true,
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
        total_marks: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        domain: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        tags: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('published', 'draft', 'scheduled'),
            defaultValue: 'draft',
            allowNull: false
        },
        is_published: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        shuffle_questions: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
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
        Quiz.belongsTo(models.Topic, { foreignKey: 'topic_id', as: 'topic' });
        Quiz.hasMany(models.QuizQuestion, { foreignKey: 'quiz_id' });
        Quiz.hasMany(models.QuizSubmission, { foreignKey: 'quiz_id' });
    };

    return Quiz;
};
