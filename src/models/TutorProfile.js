module.exports = (sequelize, DataTypes) => {
    const TutorProfile = sequelize.define('TutorProfile', {
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
        bio: DataTypes.TEXT,
        profile_photo_url: DataTypes.STRING,
        qualifications: DataTypes.TEXT,
        linkedin_url: DataTypes.STRING,
        specialization: DataTypes.STRING
    }, {
        tableName: 'tutor_profiles',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    TutorProfile.associate = (models) => {
        TutorProfile.belongsTo(models.User, { foreignKey: 'tutor_id' });
    };

    return TutorProfile;
};
