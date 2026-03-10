module.exports = (sequelize, DataTypes) => {
    const Announcement = sequelize.define('Announcement', {
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
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        priority: {
            type: DataTypes.ENUM('normal', 'important', 'urgent'),
            defaultValue: 'normal'
        }
    }, {
        tableName: 'announcements',
        paranoid: true,
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    });

    Announcement.associate = (models) => {
        Announcement.belongsTo(models.Batch, { foreignKey: 'batch_id' });
        Announcement.belongsTo(models.User, { foreignKey: 'tutor_id' });
        Announcement.hasMany(models.AnnouncementRead, { foreignKey: 'announcement_id' });
    };

    return Announcement;
};
