const Joi = require('joi');

const loginSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Must be a valid email',
        'string.empty': 'Email is required',
        'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
        'string.empty': 'Password is required',
        'any.required': 'Password is required'
    })
});

const adminCreateUserSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Must be a valid email',
        'string.empty': 'Email is required'
    }),
    password: Joi.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
        'string.empty': 'Password is required'
    }),
    role: Joi.string().valid('admin',  'institution_representative').required().messages({
        'any.only': 'Invalid role specified'
    }),
    full_name: Joi.string().optional(),
    username: Joi.string().optional(),
    institution_id: Joi.number().optional()
});

module.exports = {
    loginSchema,
    adminCreateUserSchema
};
