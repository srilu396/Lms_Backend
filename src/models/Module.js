module.exports = (sequelize, DataTypes) => {
    const Module = sequelize.define('Module', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        course_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'courses',
                key: 'id'
            }
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: DataTypes.TEXT,
        content_text: DataTypes.TEXT,
        text: DataTypes.TEXT,
        image_url: DataTypes.STRING,
        video_url: DataTypes.STRING,
        url: DataTypes.STRING,
        order_num: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        is_locked: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'modules',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false
    });

    Module.associate = (models) => {
        Module.belongsTo(models.Course, { foreignKey: 'course_id' });
        Module.hasMany(models.Topic, { foreignKey: 'module_id', as: 'topics' });
        Module.hasMany(models.Assignment, { foreignKey: 'module_id', as: 'assignments' });
        Module.hasMany(models.Quiz, { foreignKey: 'module_id', as: 'quizzes' });
        Module.hasMany(models.StudentProgress, { foreignKey: 'module_id' });
    };

    return Module;
};
