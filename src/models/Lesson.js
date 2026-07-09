module.exports = (sequelize, DataTypes) => {
    const Lesson = sequelize.define('Lesson', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        module_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'modules',
                key: 'id'
            }
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        type: {
            type: DataTypes.ENUM('video', 'text', 'image', 'mixed'),
            allowNull: false
        },
        content_text: DataTypes.TEXT,
        text: DataTypes.TEXT,
        image_url: DataTypes.STRING,
        video_url: DataTypes.STRING,
        url: DataTypes.STRING,
        pdf_url: DataTypes.STRING,
        duration_minutes: DataTypes.INTEGER,
        order_num: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'lessons',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false
    });

    Lesson.associate = (models) => {
        Lesson.belongsTo(models.Module, { foreignKey: 'module_id' });
        Lesson.hasMany(models.Topic, { foreignKey: 'lesson_id', as: 'topics' });
        Lesson.hasMany(models.LessonProgress, { foreignKey: 'lesson_id' });
        Lesson.hasMany(models.Quiz, { foreignKey: 'lesson_id', as: 'quizzes' });
        Lesson.hasMany(models.Assignment, { foreignKey: 'lesson_id', as: 'assignments' });
    };

    return Lesson;
};
