module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        full_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        role: {
            type: DataTypes.ENUM('admin', 'tutor', 'student', 'institution_representative', 'user'),
            allowNull: false
        },
        password_hash: {
            type: DataTypes.STRING,
            allowNull: false
        },
        refresh_token: {
            type: DataTypes.STRING,
            allowNull: true
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        is_first_login: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
        },
        student_code: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        },
        tutor_code: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        },
        email_verified_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        last_login_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        institution_id: {
            type: DataTypes.BIGINT,
            allowNull: true,
            references: {
                model: 'institutions',
                key: 'id'
            }
        }
    }, {
        tableName: 'users',
        paranoid: true, // Enables deleted_at
        timestamps: true, // Enables created_at and updated_at
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    });

    User.associate = (models) => {
        User.belongsTo(models.Institution, { foreignKey: 'institution_id' });
        User.hasMany(models.PasswordResetToken, { foreignKey: 'user_id' });
        User.hasMany(models.UserSession, { foreignKey: 'user_id' });
        User.hasOne(models.TutorProfile, { foreignKey: 'tutor_id' });
        User.hasMany(models.TutorInstitutionAssignment, { foreignKey: 'tutor_id' });
        User.hasMany(models.CourseTutor, { foreignKey: 'tutor_id' });
        User.hasMany(models.BatchTutor, { foreignKey: 'tutor_id' });
        User.hasMany(models.Enrollment, { foreignKey: 'student_id' });
        User.hasMany(models.QuizSubmission, { foreignKey: 'student_id' });
        User.hasMany(models.AssignmentSubmission, { foreignKey: 'student_id' });
        User.hasMany(models.StudentProgress, { foreignKey: 'student_id' });
        User.hasMany(models.LessonProgress, { foreignKey: 'student_id' });
        User.hasMany(models.StudentAttendance, { foreignKey: 'student_id' });
        User.hasMany(models.StudentRiskReport, { foreignKey: 'student_id' });
        User.hasMany(models.Announcement, { foreignKey: 'tutor_id' });
        User.hasMany(models.AnnouncementRead, { foreignKey: 'student_id' });
        User.hasMany(models.Notification, { as: 'ReceivedNotifications', foreignKey: 'recipient_user_id' });
        User.hasMany(models.Notification, { as: 'SentNotifications', foreignKey: 'sender_user_id' });
    };

    return User;
};
