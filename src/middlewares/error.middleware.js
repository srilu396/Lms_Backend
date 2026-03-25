const errorHandler = (err, req, res, next) => {
    console.error('Global Error:', err);

    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Handle Sequelize Validation/Unique errors specifically
    if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
        statusCode = 400;
        message = err.errors.map(e => e.message).join(', ');
    }

    res.status(statusCode).json({
        success: false,
        message: message,
    });
};

module.exports = errorHandler;
