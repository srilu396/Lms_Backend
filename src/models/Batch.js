module.exports = (sequelize, DataTypes) => {
    const Batch = sequelize.define('Batch', {
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
        start_date: DataTypes.DATEONLY,
        end_date: DataTypes.DATEONLY,
        course_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'courses',
                key: 'id'
            }
        },
        institution_id: {
            type: DataTypes.BIGINT,
            allowNull: true,
            references: {
                model: 'institutions',
                key: 'id'
            }
        },
        tutor_id: {
            type: DataTypes.BIGINT,
            field: 'instructor_id', // Maps the model's tutor_id to DB's instructor_id column
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.ENUM('active', 'completed', 'cancelled', 'inactive'),
            defaultValue: 'active'
        }
    }, {
        tableName: 'batches',
        paranoid: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    });

    Batch.associate = (models) => {
        Batch.belongsTo(models.Course, { foreignKey: 'course_id' });
        Batch.belongsTo(models.Institution, { foreignKey: 'institution_id' });
        Batch.belongsTo(models.User, { foreignKey: 'tutor_id', as: 'tutor' });
        Batch.hasMany(models.BatchTutor, { foreignKey: 'batch_id' });
        Batch.hasMany(models.Enrollment, { foreignKey: 'batch_id' });
        Batch.hasMany(models.AttendanceSession, { foreignKey: 'batch_id' });
        Batch.hasMany(models.StudentRiskReport, { foreignKey: 'batch_id' });
        Batch.hasOne(models.BatchPerformance, { foreignKey: 'batch_id' });
        Batch.hasMany(models.Announcement, { foreignKey: 'batch_id' });
        Batch.hasMany(models.BatchAssignment, { foreignKey: 'batch_id' });
    };

    return Batch;
};
