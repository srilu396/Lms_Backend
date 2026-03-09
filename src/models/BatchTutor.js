module.exports = (sequelize, DataTypes) => {
    const BatchTutor = sequelize.define('BatchTutor', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        batch_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'batches',
                key: 'id'
            }
        },
        tutor_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        is_primary: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        assigned_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'batch_tutors',
        timestamps: false
    });

    BatchTutor.associate = (models) => {
        BatchTutor.belongsTo(models.Batch, { foreignKey: 'batch_id' });
        BatchTutor.belongsTo(models.User, { foreignKey: 'tutor_id' });
    };

    return BatchTutor;
};
