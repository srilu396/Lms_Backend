module.exports = (sequelize, DataTypes) => {
    const Course = sequelize.define('Course', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: DataTypes.TEXT,
        thumbnail_url: DataTypes.STRING,
        institution_id: {
            type: DataTypes.BIGINT,
            allowNull: true,
            references: {
                model: 'institutions',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive', 'archived'),
            defaultValue: 'active'
        }
    }, {
        tableName: 'courses',
        paranoid: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    });

    Course.associate = (models) => {
        Course.belongsTo(models.Institution, { foreignKey: 'institution_id' });
        Course.hasMany(models.CourseTutor, { foreignKey: 'course_id' });
        Course.hasMany(models.Module, { foreignKey: 'course_id' });
        Course.hasMany(models.Batch, { foreignKey: 'course_id' });
    };

    return Course;
};
