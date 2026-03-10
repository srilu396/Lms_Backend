module.exports = (sequelize, DataTypes) => {
    const BatchPerformance = sequelize.define('BatchPerformance', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        batch_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            references: {
                model: 'batches',
                key: 'id'
            }
        },
        overall_progress: DataTypes.DECIMAL(5, 2),
        total_students: DataTypes.INTEGER,
        current_module: DataTypes.STRING,
        completion_rate: DataTypes.DECIMAL(5, 2)
    }, {
        tableName: 'batch_performance',
        timestamps: true,
        createdAt: false,
        updatedAt: 'updated_at'
    });

    BatchPerformance.associate = (models) => {
        BatchPerformance.belongsTo(models.Batch, { foreignKey: 'batch_id' });
    };

    return BatchPerformance;
};
