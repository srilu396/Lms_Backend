module.exports = (sequelize, DataTypes) => {
    const Assignment = sequelize.define('Assignment', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        course_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'courses',
                key: 'id'
            }
        },
        module_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'modules',
                key: 'id'
            }
        },
        topic_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'topics',
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
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: DataTypes.TEXT,
        instructions: DataTypes.TEXT,
        domains: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            defaultValue: []
        },
        tags: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            defaultValue: []
        },
        submission_type: {
            type: DataTypes.ENUM('file', 'link'),
            allowNull: false
        },
        max_score: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            defaultValue: 'active'
        }
    }, {
        tableName: 'assignments',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    Assignment.associate = (models) => {
        Assignment.belongsTo(models.Course, { foreignKey: 'course_id' });
        Assignment.belongsTo(models.Module, { foreignKey: 'module_id' });
        Assignment.belongsTo(models.Topic, { foreignKey: 'topic_id' });
        Assignment.belongsTo(models.Lesson, { foreignKey: 'lesson_id' });
        Assignment.hasMany(models.AssignmentCriteria, { foreignKey: 'assignment_id', as: 'evaluation_matrix', onDelete: 'CASCADE' });
        Assignment.hasMany(models.AssignmentSubmission, { foreignKey: 'assignment_id', onDelete: 'RESTRICT' });
        Assignment.hasMany(models.BatchAssignment, { foreignKey: 'assignment_id', onDelete: 'RESTRICT' });
    };

    return Assignment;
};
