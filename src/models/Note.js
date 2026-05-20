module.exports = (sequelize, DataTypes) => {
    const Note = sequelize.define('Note', {
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
        course_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'courses',
                key: 'id'
            }
        },
        lesson_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'lessons',
                key: 'id'
            }
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        timestamp: {
            type: DataTypes.STRING, // Store as "02:45" or similar for video notes
            allowNull: true
        },
        type: {
            type: DataTypes.ENUM('general', 'timestamped'),
            defaultValue: 'general'
        }
    }, {
        tableName: 'notes',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    Note.associate = (models) => {
        Note.belongsTo(models.User, { foreignKey: 'student_id' });
        Note.belongsTo(models.Course, { foreignKey: 'course_id' });
        Note.belongsTo(models.Lesson, { foreignKey: 'lesson_id' });
    };

    return Note;
};
