const Joi = require('joi');

const createDomainSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    assignment_ids: Joi.array().items(Joi.number().integer()).default([]),
    course_ids: Joi.array().items(Joi.number().integer()).default([]),
    tags: Joi.array().items(Joi.string()).default([]),
    image_url: Joi.string().uri().allow('', null),
    status: Joi.string().valid('active', 'inactive').default('active')
});

const updateDomainSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow('', null),
    assignment_ids: Joi.array().items(Joi.number().integer()),
    course_ids: Joi.array().items(Joi.number().integer()),
    tags: Joi.array().items(Joi.string()),
    image_url: Joi.string().uri().allow('', null),
    status: Joi.string().valid('active', 'inactive')
}).min(1);

module.exports = {
    createDomainSchema,
    updateDomainSchema
};
