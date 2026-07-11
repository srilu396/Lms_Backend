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
        domain_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'domains',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive', 'archived', 'draft'),
            defaultValue: 'draft'
        },
        unique_code: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        }
    }, {
        tableName: 'courses',
        paranoid: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
        hooks: {
            beforeCreate: (course) => {
                if (!course.unique_code) {
                    const crypto = require('crypto');
                    course.unique_code = `CRS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
                }
            }
        }
    });

    Course.associate = (models) => {
        Course.belongsTo(models.Institution, { foreignKey: 'institution_id' });
        Course.belongsTo(models.Domain, { foreignKey: 'domain_id', as: 'domain' });
        Course.hasMany(models.CourseTutor, { foreignKey: 'course_id', as: 'course_tutors' });
        Course.hasMany(models.Module, { foreignKey: 'course_id', as: 'modules' });
        Course.hasMany(models.Batch, { foreignKey: 'course_id', as: 'batches' });
        Course.hasMany(models.Assignment, { foreignKey: 'course_id', as: 'assignments' });
    };

    return Course;
};
