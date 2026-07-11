module.exports = (sequelize, DataTypes) => {
    const Topic = sequelize.define('Topic', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        lesson_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'lessons',
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
        pdf_url: DataTypes.STRING,
        order_num: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'topics',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        hooks: {
            beforeDestroy: async (instance, options) => {
                const { MediaAttachment } = require('../models');
                await MediaAttachment.destroy({
                    where: { entity_type: 'topic', entity_id: instance.id },
                    transaction: options.transaction
                });
            }
        }
    });

    Topic.associate = (models) => {
        Topic.belongsTo(models.Lesson, { foreignKey: 'lesson_id' });
        Topic.hasMany(models.MediaAttachment, {
            foreignKey: 'entity_id',
            constraints: false,
            scope: { entity_type: 'topic' },
            as: 'attachments'
        });
    };

    return Topic;
};
