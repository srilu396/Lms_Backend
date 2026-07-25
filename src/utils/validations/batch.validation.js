const Joi = require('joi');

const createBatchSchema = Joi.object({
    name: Joi.string().required().messages({
        'string.empty': 'Batch name is required'
    }),
    institution_id: Joi.number().integer().optional().allow(null),
    course_id: Joi.number().integer().optional().allow(null),
    domain_id: Joi.number().integer().optional().allow(null),
    tutor_id: Joi.number().integer().optional().allow(null),
    start_date: Joi.date().iso().optional().allow(null),
    end_date: Joi.date().iso().optional().allow(null),
    enroll_students: Joi.array().items(Joi.number().integer()).optional(),
    department: Joi.string().optional().allow(null, '')
}).xor('course_id', 'domain_id');

const updateBatchSchema = Joi.object({
    name: Joi.string().optional(),
    institution_id: Joi.number().integer().optional().allow(null),
    course_id: Joi.number().integer().optional().allow(null),
    domain_id: Joi.number().integer().optional().allow(null),
    tutor_id: Joi.number().integer().optional().allow(null),
    start_date: Joi.date().iso().optional().allow(null),
    end_date: Joi.date().iso().optional().allow(null),
    enroll_students: Joi.array().items(Joi.number().integer()).optional(),
    department: Joi.string().optional().allow(null, '')
}).xor('course_id', 'domain_id');

const updateBatchStatusSchema = Joi.object({
    status: Joi.string().valid('active', 'inactive').required().messages({
        'any.only': 'Status must be either active or inactive',
        'any.required': 'Status is required'
    })
});

module.exports = {
    createBatchSchema,
    updateBatchSchema,
    updateBatchStatusSchema
};

