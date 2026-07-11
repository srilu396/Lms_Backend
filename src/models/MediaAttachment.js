module.exports = (sequelize, DataTypes) => {
    const MediaAttachment = sequelize.define('MediaAttachment', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        entity_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            validate: {
                isIn: [['module', 'lesson', 'topic']]
            }
        },
        entity_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        media_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            validate: {
                isIn: [['image', 'video', 'pdf', 'url', 'text']]
            }
        },
        url: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        order_num: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        tableName: 'media_attachments',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    MediaAttachment.associate = (models) => {
        MediaAttachment.belongsTo(models.Module, {
            foreignKey: 'entity_id',
            constraints: false,
            as: 'module'
        });
        MediaAttachment.belongsTo(models.Lesson, {
            foreignKey: 'entity_id',
            constraints: false,
            as: 'lesson'
        });
        MediaAttachment.belongsTo(models.Topic, {
            foreignKey: 'entity_id',
            constraints: false,
            as: 'topic'
        });
    };

    return MediaAttachment;
};
