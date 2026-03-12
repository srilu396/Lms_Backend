const Joi = require('joi');

const createStudentSchema = Joi.object({
    first_name: Joi.string().required().messages({
        'string.empty': 'First name is required'
    }),
    last_name: Joi.string().required().messages({
        'string.empty': 'Last name is required'
    }),
    email: Joi.string().email().required().messages({
        'string.email': 'Must be a valid email',
        'string.empty': 'Email is required'
    }),
    mobile_number: Joi.string().optional(),
    password: Joi.string().min(6).required().messages({
        'string.min': 'Password must be at least 6 characters long',
        'string.empty': 'Password is required'
    }),
    notes: Joi.string().optional().allow(null, ''),
    course_id: Joi.number().integer().optional().allow(null),
    status: Joi.string().valid('active', 'inactive').optional()
});

const updateStudentSchema = Joi.object({
    first_name: Joi.string().optional(),
    last_name: Joi.string().optional(),
    email: Joi.string().email().optional(),
    mobile_number: Joi.string().optional(),
    password: Joi.string().min(6).optional(),
    notes: Joi.string().optional().allow(null, ''),
    course_id: Joi.number().integer().optional().allow(null),
    status: Joi.string().valid('active', 'inactive').optional()
});

module.exports = {
    createStudentSchema,
    updateStudentSchema
};
