module.exports = (sequelize, DataTypes) => {
    const LessonProgress = sequelize.define('LessonProgress', {
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
        lesson_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'lessons',
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
        is_completed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        video_watch_pct: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true
        },
        completed_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        last_accessed: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'lesson_progress',
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ['student_id', 'lesson_id', 'enrollment_id']
            }
        ]
    });

    LessonProgress.associate = (models) => {
        LessonProgress.belongsTo(models.User, { foreignKey: 'student_id' });
        LessonProgress.belongsTo(models.Lesson, { foreignKey: 'lesson_id' });
        LessonProgress.belongsTo(models.Enrollment, { foreignKey: 'enrollment_id' });
    };

    return LessonProgress;
};
