const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
    const Student = sequelize.define('Student', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        first_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        last_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        mobile_number: {
            type: DataTypes.STRING,
            allowNull: true
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        notes: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        course_id: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            defaultValue: 'active'
        }
    }, {
        tableName: 'students',
        paranoid: true, // Enables soft deletes (deleted_at)
        timestamps: true, // Auto adds created_at, updated_at
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
        hooks: {
            beforeCreate: async (student) => {
                if (student.password) {
                    const salt = await bcrypt.genSalt(10);
                    student.password = await bcrypt.hash(student.password, salt);
                }
            },
            beforeUpdate: async (student) => {
                if (student.changed('password')) {
                    const salt = await bcrypt.genSalt(10);
                    student.password = await bcrypt.hash(student.password, salt);
                }
            }
        }
    });

    Student.associate = function(models) {
        // Prepare for future Course association
        if (models.Course) {
            Student.belongsTo(models.Course, { foreignKey: 'course_id', as: 'course' });
        }
    };

    return Student;
};
