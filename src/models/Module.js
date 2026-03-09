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
        Module.hasMany(models.Topic, { foreignKey: 'module_id' });
        Module.hasMany(models.Assignment, { foreignKey: 'module_id' });
        Module.hasMany(models.StudentProgress, { foreignKey: 'module_id' });
    };

    return Module;
};
