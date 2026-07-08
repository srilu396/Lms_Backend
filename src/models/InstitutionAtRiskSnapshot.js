module.exports = (sequelize, DataTypes) => {
    const InstitutionAtRiskSnapshot = sequelize.define('InstitutionAtRiskSnapshot', {
        institution_id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            allowNull: false,
            references: {
                model: 'institutions',
                key: 'id'
            }
        },
        count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    }, {
        tableName: 'institution_at_risk_snapshot',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    InstitutionAtRiskSnapshot.associate = (models) => {
        InstitutionAtRiskSnapshot.belongsTo(models.Institution, { foreignKey: 'institution_id' });
    };

    return InstitutionAtRiskSnapshot;
};
