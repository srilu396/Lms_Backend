const { Sequelize } = require('sequelize');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = process.env.DATABASE_URL;

// Determine SSL options intelligently:
// 1. Explicit DB_SSL env variable takes highest precedence
// 2. Query parameters (?sslmode=disable or ?sslmode=require) in DATABASE_URL
// 3. Internal hostnames (.internal, localhost) do not use SSL
// 4. In production with external hosts, default to SSL with rejectUnauthorized: false
const getSslConfig = (url) => {
    if (process.env.DB_SSL === 'false') return false;
    if (process.env.DB_SSL === 'true') {
        return { require: true, rejectUnauthorized: false };
    }
    if (!url) return false;
    if (url.includes('sslmode=disable')) return false;
    if (url.includes('sslmode=require') || url.includes('sslmode=prefer')) {
        return { require: true, rejectUnauthorized: false };
    }
    try {
        const parsed = new URL(url);
        const host = parsed.hostname;
        if (
            host === 'localhost' ||
            host === '127.0.0.1' ||
            host.endsWith('.internal') ||
            host.endsWith('.local')
        ) {
            return false;
        }
    } catch (_) {}
    if (isProduction) {
        return { require: true, rejectUnauthorized: false };
    }
    return false;
};

const sslConfig = getSslConfig(databaseUrl);

// Use placeholder URL if DATABASE_URL is not yet defined to allow requiring models during test/build
const sequelize = new Sequelize(databaseUrl || 'postgres://localhost:5432/placeholder_db', {
    dialect: 'postgres',
    protocol: 'postgres',
    dialectOptions: sslConfig ? { ssl: sslConfig } : {},
    pool: {
        max: Number(process.env.DB_POOL_MAX || 5),
        min: Number(process.env.DB_POOL_MIN || 0),
        acquire: Number(process.env.DB_POOL_ACQUIRE || 30000),
        idle: Number(process.env.DB_POOL_IDLE || 10000)
    },
    logging: false // set to console.log to see SQL queries
});

const connectDB = async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL environment variable is missing.');
    }

    const maxRetries = 3;
    const retryDelayMs = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[Database] Connecting to PostgreSQL (attempt ${attempt}/${maxRetries})...`);
            await sequelize.authenticate();
            console.log('[Database] PostgreSQL connection established successfully.');
            return;
        } catch (err) {
            console.error(`[Database Error] Connection attempt ${attempt}/${maxRetries} failed: ${err.message}`);

            if (err.message && err.message.includes('server does not support SSL')) {
                console.warn('[Database Tip] The database server rejected SSL. Consider setting DB_SSL=false or appending ?sslmode=disable to DATABASE_URL in Render.');
            }

            if (attempt === maxRetries) {
                console.error('[Database Error] All database connection attempts failed. Check DATABASE_URL and database availability.');
                throw err;
            }

            console.log(`[Database] Retrying in ${retryDelayMs / 1000}s...`);
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
    }
};

module.exports = { sequelize, connectDB };

