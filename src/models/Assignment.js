module.exports = (sequelize, DataTypes) => {
    const Assignment = sequelize.define('Assignment', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        module_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'modules',
                key: 'id'
            }
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        instructions: DataTypes.TEXT,
        max_score: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('active', 'completed', 'cancelled'),
            defaultValue: 'active'
        }
    }, {
        tableName: 'assignments',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    Assignment.associate = (models) => {
        Assignment.belongsTo(models.Module, { foreignKey: 'module_id' });
        Assignment.hasMany(models.AssignmentCriteria, { foreignKey: 'assignment_id' });
        Assignment.hasMany(models.AssignmentSubmission, { foreignKey: 'assignment_id' });
        Assignment.hasMany(models.BatchAssignment, { foreignKey: 'assignment_id' });
    };

    return Assignment;
};
