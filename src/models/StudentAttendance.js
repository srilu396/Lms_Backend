module.exports = (sequelize, DataTypes) => {
    const StudentAttendance = sequelize.define('StudentAttendance', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        student_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        session_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'attendance_sessions',
                key: 'id'
            }
        },
        enrollment_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'enrollments',
                key: 'id'
            }
        },
        status: {
            type: DataTypes.ENUM('present', 'absent', 'late'),
            allowNull: false
        },
        marked_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'student_attendance',
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ['student_id', 'session_id']
            }
        ]
    });

    StudentAttendance.associate = (models) => {
        StudentAttendance.belongsTo(models.User, { foreignKey: 'student_id' });
        StudentAttendance.belongsTo(models.AttendanceSession, { foreignKey: 'session_id' });
        StudentAttendance.belongsTo(models.Enrollment, { foreignKey: 'enrollment_id' });
    };

    return StudentAttendance;
};
