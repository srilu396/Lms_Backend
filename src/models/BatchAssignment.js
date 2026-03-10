module.exports = (sequelize, DataTypes) => {
    const BatchAssignment = sequelize.define('BatchAssignment', {
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
        batch_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'batches',
                key: 'id'
            }
        },
        due_date: {
            type: DataTypes.DATEONLY,
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('active', 'completed', 'cancelled'),
            defaultValue: 'active'
        }
    }, {
        tableName: 'batch_assignments',
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ['assignment_id', 'batch_id']
            }
        ]
    });

    BatchAssignment.associate = (models) => {
        BatchAssignment.belongsTo(models.Assignment, { foreignKey: 'assignment_id' });
        BatchAssignment.belongsTo(models.Batch, { foreignKey: 'batch_id' });
    };

    return BatchAssignment;
};
