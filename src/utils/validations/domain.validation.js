const Joi = require('joi');

const createDomainSchema = Joi.object({
    name: Joi.string().trim().required().messages({
        'string.empty': 'Domain name is required',
        'any.required': 'Domain name is required'
    }),
    description: Joi.string().allow('', null)
});

const updateDomainSchema = Joi.object({
    name: Joi.string().trim(),
    description: Joi.string().allow('', null)
}).min(1);

const updateDomainStatusSchema = Joi.object({
    status: Joi.string().valid('active', 'inactive').required().messages({
        'any.only': 'Invalid status. Status must be either active or inactive',
        'any.required': 'Status is required'
    })
});

module.exports = {
    createDomainSchema,
    updateDomainSchema,
    updateDomainStatusSchema
};

