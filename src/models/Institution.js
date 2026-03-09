module.exports = (sequelize, DataTypes) => {
    const Institution = sequelize.define('Institution', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: DataTypes.TEXT,
        address: DataTypes.STRING,
        phone: DataTypes.STRING,
        email: {
            type: DataTypes.STRING,
            validate: {
                isEmail: true
            }
        },
        logo_url: DataTypes.STRING,
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'institutions',
        paranoid: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    });

    Institution.associate = (models) => {
        Institution.hasMany(models.InstitutionContact, { foreignKey: 'institution_id' });
        Institution.hasMany(models.TutorInstitutionAssignment, { foreignKey: 'institution_id' });
        Institution.hasMany(models.Course, { foreignKey: 'institution_id' });
        Institution.hasMany(models.Batch, { foreignKey: 'institution_id' });
    };

    return Institution;
};
