module.exports = (sequelize, DataTypes) => {
    const AttendanceSession = sequelize.define('AttendanceSession', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        batch_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'batches',
                key: 'id'
            }
        },
        session_date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        session_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        start_time: DataTypes.TIME,
        end_time: DataTypes.TIME
    }, {
        tableName: 'attendance_sessions',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                unique: true,
                fields: ['batch_id', 'session_date', 'session_name']
            }
        ]
    });

    AttendanceSession.associate = (models) => {
        AttendanceSession.belongsTo(models.Batch, { foreignKey: 'batch_id' });
        AttendanceSession.hasMany(models.StudentAttendance, { foreignKey: 'session_id' });
    };

    return AttendanceSession;
};
