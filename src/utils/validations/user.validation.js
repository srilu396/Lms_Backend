const Joi = require('joi');

const createUserSchema = Joi.object({
    full_name: Joi.string().required().messages({
        'string.empty': 'Full name is required'
    }),
    email: Joi.string().email().required().messages({
        'string.email': 'Must be a valid email',
        'string.empty': 'Email is required'
    }),
    password: Joi.string().min(6).required().messages({
        'string.min': 'Password must be at least 6 characters long',
        'string.empty': 'Password is required'
    }),
    role: Joi.string().valid('admin', 'institution_representative').required().messages({
        'any.only': 'Invalid role specified, only admin and institution_representative are allowed'
    }),
    institution_name: Joi.string().optional(),
    institution_id: Joi.alternatives().try(Joi.number(), Joi.string()).optional()
});

const updateUserSchema = Joi.object({
    full_name: Joi.string().optional(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(6).optional(),
    role: Joi.string().valid('admin', 'institution_representative').optional(),
    institution_name: Joi.string().optional(),
    institution_id: Joi.alternatives().try(Joi.number(), Joi.string()).optional()
});

const updateUserStatusSchema = Joi.object({
    status: Joi.string().valid('active', 'inactive').required().messages({
        'any.only': 'Status must be either active or inactive',
        'any.required': 'Status is required'
    })
});

module.exports = {
    createUserSchema,
    updateUserSchema,
    updateUserStatusSchema
};

