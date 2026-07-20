module.exports = (sequelize, DataTypes) => {
    const TopicProgress = sequelize.define('TopicProgress', {
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
        topic_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'topics',
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
        completed_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        last_accessed: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'topic_progress',
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ['student_id', 'topic_id', 'enrollment_id']
            }
        ]
    });

    TopicProgress.associate = (models) => {
        TopicProgress.belongsTo(models.User, { foreignKey: 'student_id' });
        TopicProgress.belongsTo(models.Topic, { foreignKey: 'topic_id' });
        TopicProgress.belongsTo(models.Enrollment, { foreignKey: 'enrollment_id' });
    };

    return TopicProgress;
};
