module.exports = (sequelize, DataTypes) => {
    const UserSession = sequelize.define('UserSession', {
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
        session_token: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        },
        ip_address: DataTypes.STRING,
        user_agent: DataTypes.TEXT,
        last_accessed_at: DataTypes.DATE
    }, {
        tableName: 'user_sessions',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false
    });

    UserSession.associate = (models) => {
        UserSession.belongsTo(models.User, { foreignKey: 'user_id' });
    };

    return UserSession;
};
