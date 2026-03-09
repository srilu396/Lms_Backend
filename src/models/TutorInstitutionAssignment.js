module.exports = (sequelize, DataTypes) => {
    const TutorInstitutionAssignment = sequelize.define('TutorInstitutionAssignment', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        tutor_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        institution_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
                model: 'institutions',
                key: 'id'
            }
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        assigned_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        removed_at: DataTypes.DATE
    }, {
        tableName: 'tutor_institution_assignments',
        timestamps: false
    });

    TutorInstitutionAssignment.associate = (models) => {
        TutorInstitutionAssignment.belongsTo(models.User, { foreignKey: 'tutor_id' });
        TutorInstitutionAssignment.belongsTo(models.Institution, { foreignKey: 'institution_id' });
    };

    return TutorInstitutionAssignment;
};
