module.exports = (sequelize, DataTypes) => {
    const Lesson = sequelize.define('Lesson', {
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
        type: {
            type: DataTypes.ENUM('video', 'text', 'image', 'mixed'),
            allowNull: false
        },
        content_text: DataTypes.TEXT,
        text: DataTypes.TEXT,
        image_url: DataTypes.STRING,
        video_url: DataTypes.STRING,
        url: DataTypes.STRING,
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
        Lesson.belongsTo(models.Topic, { foreignKey: 'topic_id' });
        Lesson.hasMany(models.LessonProgress, { foreignKey: 'lesson_id' });
    };

    return Lesson;
};
