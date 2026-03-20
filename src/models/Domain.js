'use strict';

module.exports = (sequelize, DataTypes) => {
    const Domain = sequelize.define('Domain', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        image_url: {
            type: DataTypes.STRING,
            allowNull: true
        },
        assignment_ids: {
            type: DataTypes.ARRAY(DataTypes.INTEGER),
            defaultValue: []
        },
        tags: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            defaultValue: []
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive'),
            defaultValue: 'active'
        }
    }, {
        tableName: 'domains',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    Domain.associate = (models) => {
        // Assignments are stored as an array of IDs; we fetch them manually in the service
    };

    return Domain;
};
