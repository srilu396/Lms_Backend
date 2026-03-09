module.exports = (sequelize, DataTypes) => {
    const PasswordResetToken = sequelize.define('PasswordResetToken', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        user_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        token: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        is_used: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'password_reset_tokens',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false
    });

    PasswordResetToken.associate = (models) => {
        PasswordResetToken.belongsTo(models.User, { foreignKey: 'user_id' });
    };

    return PasswordResetToken;
};
