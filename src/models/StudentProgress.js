module.exports = (sequelize, DataTypes) => {
    const StudentProgress = sequelize.define('StudentProgress', {
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
        module_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'modules',
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
        progress_pct: {
            type: DataTypes.DECIMAL(5, 2),
            defaultValue: 0.00
        },
        is_completed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        weekly_engagement: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true
        },
        risk_status: {
            type: DataTypes.ENUM('critical', 'warning', 'normal'),
            defaultValue: 'normal'
        },
        last_accessed: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'student_progress',
        timestamps: true,
        createdAt: false,
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['student_id', 'module_id', 'enrollment_id']
            }
        ]
    });

    StudentProgress.associate = (models) => {
        StudentProgress.belongsTo(models.User, { foreignKey: 'student_id' });
        StudentProgress.belongsTo(models.Module, { foreignKey: 'module_id' });
        StudentProgress.belongsTo(models.Enrollment, { foreignKey: 'enrollment_id' });
    };

    return StudentProgress;
};
