require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
    development: {
        url: process.env.DATABASE_URL,
        dialect: 'postgres',
        dialectOptions: isProduction ? {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        } : {}
    },
    test: {
        url: process.env.DATABASE_URL,
        dialect: 'postgres'
    },
    production: {
        url: process.env.DATABASE_URL,
        dialect: 'postgres',
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    }
};
