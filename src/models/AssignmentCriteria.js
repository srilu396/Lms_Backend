module.exports = (sequelize, DataTypes) => {
    const AssignmentCriteria = sequelize.define('AssignmentCriteria', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        assignment_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'assignments',
                key: 'id'
            }
        },
        criteria_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        max_points: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false
        },
        description: DataTypes.TEXT
    }, {
        tableName: 'assignment_criteria',
        timestamps: false
    });

    AssignmentCriteria.associate = (models) => {
        AssignmentCriteria.belongsTo(models.Assignment, { foreignKey: 'assignment_id' });
    };

    return AssignmentCriteria;
};
