const Joi = require('joi');

const updateProfileSchema = Joi.object({
    full_name: Joi.string().min(2).max(100).optional().messages({
        'string.min': 'Must be at least 2 characters',
        'string.max': 'Must be at most 100 characters'
    }),
    username: Joi.string().min(1).optional().messages({
        'string.empty': 'Must be a non-empty string'
    }),
    phone_number: Joi.string().pattern(/^\+?[0-9]{10,15}$/).allow(null).optional().messages({
        'string.pattern.base': 'Invalid phone number format'
    }),
    avatar_url: Joi.string().uri().allow(null).optional().messages({
        'string.uri': 'Must be a valid URL string'
    }),
    designation: Joi.string().min(1).max(100).optional().messages({
        'string.empty': 'Must be a non-empty string',
        'string.max': 'Must be at most 100 characters'
    })
});

module.exports = {
    updateProfileSchema
};
