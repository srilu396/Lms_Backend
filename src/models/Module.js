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
        pdf_url: DataTypes.STRING,
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
        updatedAt: false,
        hooks: {
            beforeDestroy: async (instance, options) => {
                const { MediaAttachment } = require('../models');
                await MediaAttachment.destroy({
                    where: { entity_type: 'module', entity_id: instance.id },
                    transaction: options.transaction
                });
            }
        }
    });

    Module.associate = (models) => {
        Module.belongsTo(models.Course, { foreignKey: 'course_id' });
        Module.hasMany(models.Lesson, { foreignKey: 'module_id', as: 'lessons' });
        Module.hasMany(models.Assignment, { foreignKey: 'module_id', as: 'assignments' });
        Module.hasMany(models.Quiz, { foreignKey: 'module_id', as: 'quizzes' });
        Module.hasMany(models.StudentProgress, { foreignKey: 'module_id' });
        Module.hasMany(models.MediaAttachment, {
            foreignKey: 'entity_id',
            constraints: false,
            scope: { entity_type: 'module' },
            as: 'attachments'
        });
    };

    return Module;
};
