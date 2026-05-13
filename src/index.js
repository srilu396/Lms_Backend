require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');

const { connectDB } = require('./db/connect');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Headers
app.use(helmet());

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'];
app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

// Compress responses
app.use(compression());

// Middleware setup
app.use(express.json()); // Used to parse JSON bodies
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
        app.listen(PORT, () => {
            console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start the server due to database connection issue');
    }
};

startServer();
