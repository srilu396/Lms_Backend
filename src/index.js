require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { connectDB, sequelize } = require('./db/connect');

const app = express();
const PORT = process.env.PORT || 5000;

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

app.use(express.json({ limit: '10mb' })); // Used to parse JSON bodies, with limit
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies
app.use(cookieParser());


// Static folder for file uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


// Default status route
app.get('/', (req, res) => {
    res.json({ message: 'LMS Backend API is running' });
});

// Register API Routes
app.use('/auth', require('./routes/auth.routes'));
app.use('/admin', require('./routes/admin.routes'));

// Example Protected Route
const authMiddleware = require('./middlewares/auth.middleware');
app.get('/profile', authMiddleware, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.id,
            email: req.user.email,
            role: req.user.role,
            full_name: req.user.full_name
        }
    });
});

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
app.use('/api/v1/institution-rep/profile', require('./routes/institutionRep/profile.routes'));
app.use('/api/v1/institution-rep/student-performance', require('./routes/institutionRep/student-performance.routes'));
app.use('/api/v1/contact-requests', require('./routes/contact.routes'));
app.use('/api/v1/enrollments', require('./routes/enrollment.routes'));
app.use('/api/v1/progress', require('./routes/progress.routes'));
app.use('/api/v1/attendance', require('./routes/attendance.routes'));

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
        await connectDB();
        const server = app.listen(PORT, () => {
        });

        // Graceful shutdown handler
        const shutdown = async (signal) => {
            console.log(`\n${signal} received. Shutting down gracefully...`);
            server.close(async () => {
                console.log('HTTP server closed.');
                try {
                    await sequelize.close();
                    console.log('Database connection closed.');
                    process.exit(0);
                } catch (err) {
                    console.error('Error closing database connection:', err);
                    process.exit(1);
                }
            });
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

    } catch (error) {
    }
};

startServer();
