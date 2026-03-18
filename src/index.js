require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./db/connect');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware setup
app.use(cors()); // Used to enable CORS
app.use(express.json()); // Used to parse JSON bodies

// Default status route
app.get('/', (req, res) => {
    res.json({ message: 'LMS Backend API is running' });
});

// Register API Routes
app.use('/api/v1/users', require('./routes/user.routes'));
app.use('/api/v1/institutions', require('./routes/institution.routes'));
app.use('/api/v1/students', require('./routes/student.routes'));
app.use('/api/v1/courses', require('./routes/course.routes'));
app.use('/api/v1/modules', require('./routes/module.routes'));
app.use('/api/v1/topics', require('./routes/topic.routes'));
app.use('/api/v1/lessons', require('./routes/lesson.routes'));

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
