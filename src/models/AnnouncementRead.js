module.exports = (sequelize, DataTypes) => {
    const AnnouncementRead = sequelize.define('AnnouncementRead', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        announcement_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'announcements',
                key: 'id'
            }
        },
        student_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        read_at: {
            type: DataTypes.DATE,
            allowNull: true
        }
    }, {
        tableName: 'announcement_reads',
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ['announcement_id', 'student_id']
            }
        ]
    });

    AnnouncementRead.associate = (models) => {
        AnnouncementRead.belongsTo(models.Announcement, { foreignKey: 'announcement_id' });
        AnnouncementRead.belongsTo(models.User, { foreignKey: 'student_id' });
    };

    return AnnouncementRead;
};
