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
        domain_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'domains',
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
        status: {
            type: DataTypes.ENUM('active', 'completed', 'cancelled', 'inactive'),
            defaultValue: 'active'
        },
        department: {
            type: DataTypes.STRING,
            allowNull: true
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
        Batch.belongsTo(models.Domain, { foreignKey: 'domain_id' });
        Batch.belongsTo(models.Institution, { foreignKey: 'institution_id' });
        Batch.hasMany(models.BatchTutor, { foreignKey: 'batch_id', as: 'batchTutors' });
        Batch.belongsToMany(models.User, { through: models.BatchTutor, foreignKey: 'batch_id', otherKey: 'tutor_id', as: 'tutors' });
        Batch.hasMany(models.Enrollment, { foreignKey: 'batch_id' });
        Batch.hasMany(models.AttendanceSession, { foreignKey: 'batch_id' });
        Batch.hasMany(models.StudentRiskReport, { foreignKey: 'batch_id' });
        Batch.hasOne(models.BatchPerformance, { foreignKey: 'batch_id' });
        Batch.hasMany(models.Announcement, { foreignKey: 'batch_id' });
        Batch.hasMany(models.BatchAssignment, { foreignKey: 'batch_id' });
    };

    return Batch;
};
