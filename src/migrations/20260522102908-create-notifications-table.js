'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      role: {
        type: Sequelize.ENUM('institution_representative', 'tutor', 'student'),
        allowNull: false
      },
      type: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      reference_id: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      reference_type: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      is_read: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('notifications', ['user_id', 'is_read']);
    await queryInterface.addIndex('notifications', ['user_id', 'created_at'], {
      order: [['created_at', 'DESC']]
    });

    await queryInterface.createTable('institution_at_risk_snapshot', {
      institution_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
          model: 'institutions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      at_risk_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      updated_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('institution_at_risk_snapshot');
    await queryInterface.dropTable('notifications');
  }
};
