module.exports = (sequelize, DataTypes) => {
    const CourseTutor = sequelize.define('CourseTutor', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        course_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'courses',
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
        role: {
            type: DataTypes.ENUM('primary', 'co_tutor'),
            allowNull: false
        },
        assigned_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'course_tutors',
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ['course_id'],
                where: { role: 'primary' }
            }
        ]
    });

    CourseTutor.associate = (models) => {
        CourseTutor.belongsTo(models.Course, { foreignKey: 'course_id' });
        CourseTutor.belongsTo(models.User, { foreignKey: 'tutor_id' });
    };

    return CourseTutor;
};
