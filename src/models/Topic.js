module.exports = (sequelize, DataTypes) => {
    const Topic = sequelize.define('Topic', {
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
        description: DataTypes.TEXT,
        content_text: DataTypes.TEXT,
        text: DataTypes.TEXT,
        image_url: DataTypes.STRING,
        video_url: DataTypes.STRING,
        url: DataTypes.STRING,
        order_num: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'topics',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false
    });

    Topic.associate = (models) => {
        Topic.belongsTo(models.Module, { foreignKey: 'module_id' });
        Topic.hasMany(models.Lesson, { foreignKey: 'topic_id' });
        Topic.hasMany(models.Quiz, { foreignKey: 'topic_id' });
    };

    return Topic;
};
