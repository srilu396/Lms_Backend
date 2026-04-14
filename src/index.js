require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { connectDB } = require('./db/connect');

const app = express();
const PORT = process.env.PORT || 5000;

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
app.use('/api/v1/contact-requests', require('./routes/contact.routes'));
app.use('/api/v1/enrollments', require('./routes/enrollment.routes'));

// Global Error Handler
const errorHandler = require('./middlewares/error.middleware');
app.use(errorHandler);

// Start the server only after connecting to the database
const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start the server due to database connection issue');
    }
};

startServer();
