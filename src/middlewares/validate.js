const Joi = require('joi');

const validate = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            const errorMessage = error.details.map((details) => details.message).join(', ');
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: errorMessage
            });
        }
        req.body = value;
        return next();
    };
};

module.exports = validate;
