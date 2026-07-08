module.exports = (sequelize, DataTypes) => {
    const Notification = sequelize.define('Notification', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        recipient_user_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        sender_user_id: {
            type: DataTypes.BIGINT,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        type: {
            type: DataTypes.ENUM(
                'assignment_submitted',
                'announcement_created',
                'quiz_graded',
                'assignment_graded',
                'attendance_marked',
                'risk_alert',
                'system',
                'BATCH_CREATED',
                'BATCH_ALLOCATED_TUTOR',
                'BATCH_ALLOCATED_STUDENT',
                'TOP_PERFORMER',
                'LEAST_PERFORMER',
                'ATTENDANCE_WARNING',
                'AT_RISK_INCREASED',
                'ASSIGNMENT_SUBMITTED',
                'ASSIGNMENT_ADDED'
            ),
            allowNull: false
        },
        title: DataTypes.STRING,
        message: DataTypes.TEXT,
        reference_type: DataTypes.STRING,
        reference_id: {
            type: DataTypes.BIGINT,
            allowNull: true
        },
        is_read: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        read_at: DataTypes.DATE
    }, {
        tableName: 'notifications',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false
    });

    Notification.associate = (models) => {
        Notification.belongsTo(models.User, { as: 'Recipient', foreignKey: 'recipient_user_id' });
        Notification.belongsTo(models.User, { as: 'Sender', foreignKey: 'sender_user_id' });
    };

    return Notification;
};
