module.exports = (sequelize, DataTypes) => {
    const StudentRiskReport = sequelize.define('StudentRiskReport', {
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
        batch_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'batches',
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
        avg_quiz_score: DataTypes.DECIMAL(5, 2),
        attendance_percentage: DataTypes.DECIMAL(5, 2),
        risk_status: {
            type: DataTypes.ENUM('critical', 'warning', 'normal'),
            defaultValue: 'normal'
        },
        notes: DataTypes.TEXT,
        report_date: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'student_risk_reports',
        timestamps: false
    });

    StudentRiskReport.associate = (models) => {
        StudentRiskReport.belongsTo(models.User, { foreignKey: 'student_id' });
        StudentRiskReport.belongsTo(models.Batch, { foreignKey: 'batch_id' });
        StudentRiskReport.belongsTo(models.Enrollment, { foreignKey: 'enrollment_id' });
    };

    return StudentRiskReport;
};
