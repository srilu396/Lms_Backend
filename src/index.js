require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const validateEnv = require('./config/validateEnv');
const { connectDB, sequelize } = require('./db/connect');

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
const HOST = process.env.HOST || '0.0.0.0';
const BODY_LIMIT = process.env.BODY_LIMIT || '100mb';

// Trust proxy for rate limiting behind reverse proxies (Render, Heroku, etc.)
app.set('trust proxy', 1);

// Security Headers
app.use(helmet({
    crossOriginResourcePolicy: false, // allow cross-origin image loading
}));

// Compress responses
app.use(compression());

// Middleware setup
const corsOptions = require('./config/corsOptions');

// Handle Pre-flight requests for all routes (important for Authorization headers / Credentials)
app.options('*', cors(corsOptions));

// Apply CORS middleware
app.use(cors(corsOptions)); 

// Apply rate limiting to all requests
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { success: false, message: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use(limiter);

app.use(express.json({ limit: BODY_LIMIT, strict: false }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT, parameterLimit: 100000 }));
app.use(cookieParser());


// Static folder for file uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


// Health and status routes
app.get('/', (req, res) => {
    res.json({ message: 'LMS Backend API is running' });
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Register API Routes
app.use('/auth', require('./routes/auth.routes'));
app.use('/api/v1/admin', require('./routes/admin.routes'));

// Unified Profile Routes
app.use('/api/v1/profile', require('./routes/profile.routes'));

app.use('/api/v1/users', require('./routes/user.routes'));
app.use('/api/v1/institutions', require('./routes/institution.routes'));
app.use('/api/v1/students', require('./routes/student.routes'));
app.use('/api/v1/courses', require('./routes/course.routes'));
app.use('/api/v1/modules', require('./routes/module.routes'));
app.use('/api/v1/topics', require('./routes/topic.routes'));
app.use('/api/v1/lessons', require('./routes/lesson.routes'));
app.use('/api/v1/assignments', require('./routes/assignment.routes'));
app.use('/api/v1/domains', require('./routes/domain.routes'));
app.use('/api/v1/quizzes', require('./routes/quiz.routes'));
app.use('/api/v1/tutors', require('./routes/tutor.routes'));
app.use('/api/v1/batches', require('./routes/batch.routes'));
app.use('/api/v1/institution-rep/batches', require('./routes/institutionRep/batches.routes'));
app.use('/api/v1/institution-rep/batches', require('./routes/institutionRep/batch-details.routes'));
app.use('/api/v1/institution-rep/batches', require('./routes/institutionRep/batch-students.routes'));
app.use('/api/v1/institution-rep/batches', require('./routes/institutionRep/export-report.routes'));
app.use('/api/v1/institution-rep/batches', require('./routes/institutionRep/attendance-calendar.routes'));
app.use('/api/v1/institution-rep/reports', require('./routes/institutionRep/reports.routes'));
app.use('/api/v1/institution-rep/dashboard', require('./routes/institutionRep/dashboard.routes'));
app.use('/api/v1/institution-rep/student-performance', require('./routes/institutionRep/student-performance.routes'));
app.use('/api/v1/contact-requests', require('./routes/contact.routes'));
app.use('/api/v1/enrollments', require('./routes/enrollment.routes'));
app.use('/api/v1/progress', require('./routes/progress.routes'));
app.use('/api/v1/attendance', require('./routes/attendance.routes'));
app.use('/api/v1/notifications', require('./routes/notification.routes'));

// Tutor Portal Routes
app.use('/api/v1/tutor-portal', require('./routes/tutor-portal.routes'));

// Student Portal Routes
app.use('/api/v1/student-portal', require('./routes/student-portal.routes'));

// Global Error Handler
const errorHandler = require('./middlewares/error.middleware');
app.use(errorHandler);

// Start the server only after connecting to the database
const startServer = async () => {
    try {
        // Validate required environment variables before initializing connections
        validateEnv();

        // Connect to PostgreSQL database
        await connectDB();

        const isProduction = process.env.NODE_ENV === 'production';

        const listenWithFallback = async (port, host) => {
            return await new Promise((resolve, reject) => {
                const server = app.listen(port, host, () => resolve(server));
                server.on('error', (error) => {
                    reject(error);
                });
            });
        };

        let server;
        try {
            server = await listenWithFallback(PORT, HOST);
        } catch (error) {
            if (error.code === 'EADDRINUSE') {
                if (!isProduction) {
                    console.warn(`[Server] Port ${PORT} is busy. Falling back to an available port in development.`);
                    server = await listenWithFallback(0, HOST);
                } else {
                    console.error(`[Server Error] Port ${PORT} is already in use.`);
                    throw error;
                }
            } else {
                throw error;
            }
        }

        const address = server.address();
        const actualPort = typeof address === 'object' && address ? address.port : PORT;
        console.log(`[Server] Listening on ${HOST}:${actualPort} (NODE_ENV=${process.env.NODE_ENV || 'development'})`);

        // Graceful shutdown handler
        const shutdown = async (signal) => {
            console.log(`\n[Server] ${signal} received. Shutting down gracefully...`);
            server.close(async () => {
                console.log('[Server] HTTP server closed.');
                try {
                    await sequelize.close();
                    console.log('[Database] Database connection closed.');
                    process.exit(0);
                } catch (err) {
                    console.error('[Database] Error closing database connection:', err.message);
                    process.exit(1);
                }
            });
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

    } catch (error) {
        console.error('[Server Startup Failure]:', error.message || error);
        process.exit(1);
    }
};

startServer();
