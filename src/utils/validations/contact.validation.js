const Joi = require('joi');

const createContactRequestSchema = Joi.object({
    full_name: Joi.string().required().messages({
        'string.empty': 'Full name is required'
    }),
    email: Joi.string().email().required().messages({
        'string.email': 'Must be a valid email',
        'string.empty': 'Email is required'
    }),
    role: Joi.string().valid('admin', 'institution_representative').required().messages({
        'any.only': 'Invalid role specified, must be either admin or institution_representative'
    }),
    message: Joi.string().required().messages({
        'string.empty': 'Message is required'
    })
});

module.exports = {
    createContactRequestSchema
};
