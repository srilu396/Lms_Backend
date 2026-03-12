module.exports = (sequelize, DataTypes) => {
    const InstitutionContact = sequelize.define('InstitutionContact', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        institution_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
                model: 'institutions',
                key: 'id'
            }
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            validate: {
                isEmail: true
            }
        },
        phone: DataTypes.STRING,
        role: DataTypes.STRING,
        is_primary: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'institution_contacts',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false
    });

    InstitutionContact.associate = (models) => {
        InstitutionContact.belongsTo(models.Institution, { foreignKey: 'institution_id' });
    };

    return InstitutionContact;
};
