const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Ensure SSL is used in production (e.g., on Render)
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const connectDB = async () => {
    try {
        const client = await pool.connect();
        console.log('Successfully connected to PostgreSQL database');
        client.release(); // Release the client back to the pool
    } catch (err) {
        console.error('Error connecting to PostgreSQL database:', err.stack);
        process.exit(1); // Exit process with failure
    }
};

module.exports = { pool, connectDB };
