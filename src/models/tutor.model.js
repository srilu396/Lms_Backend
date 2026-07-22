const bcrypt = require('bcryptjs');

module.exports = (sequelize, DataTypes) => {
    const Tutor = sequelize.define('Tutor', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        full_name: {
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
        domains: {
            type: DataTypes.JSON, // Storing tags as JSON array
            allowNull: true,
            defaultValue: []
        },
        tags: {
            type: DataTypes.JSON, // Storing tags as JSON array
            allowNull: true,
            defaultValue: []
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            defaultValue: 'active'
        },
        profile_image: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null
        },
        unique_code: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        }
    }, {
        tableName: 'tutors',
        paranoid: true, // Enables soft deletes (deleted_at)
        timestamps: true, // Auto adds created_at, updated_at
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
        hooks: {
            beforeCreate: async (tutor) => {
                if (!tutor.unique_code) {
                    const crypto = require('crypto');
                    tutor.unique_code = `TUT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
                }
                if (tutor.password) {
                    const salt = await bcrypt.genSalt(10);
                    tutor.password = await bcrypt.hash(tutor.password, salt);
                }
            },
            beforeUpdate: async (tutor) => {
                if (tutor.changed('password')) {
                    const salt = await bcrypt.genSalt(10);
                    tutor.password = await bcrypt.hash(tutor.password, salt);
                }
            }
        }
    });

    Tutor.associate = function(models) {
        Tutor.hasMany(models.BatchTutor, { foreignKey: 'tutor_id', as: 'batchTutors' });
        Tutor.belongsToMany(models.Batch, { through: models.BatchTutor, foreignKey: 'tutor_id', otherKey: 'batch_id', as: 'batches' });
    };

    return Tutor;
};
