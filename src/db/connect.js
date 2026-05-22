const { Sequelize } = require('sequelize');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: isProduction ? {
        ssl: {
            require: true,
            rejectUnauthorized: false
        }
    } : {},
    logging: false // set to console.log to see SQL queries
});

const connectDB = async () => {
    try {
        await sequelize.authenticate();
    } catch (err) {
        process.exit(1); // Exit process with failure
    }
};

module.exports = { sequelize, connectDB };
