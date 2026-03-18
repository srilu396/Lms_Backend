const Joi = require('joi');

const createCourseSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    thumbnail_url: Joi.string().uri().allow('', null),
    institution_id: Joi.number().integer().allow(null)
});

const updateCourseSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow('', null),
    thumbnail_url: Joi.string().uri().allow('', null),
    institution_id: Joi.number().integer().allow(null)
}).min(1);

const createModuleSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    image_url: Joi.string().uri().allow('', null),
    video_url: Joi.string().uri().allow('', null),
    url: Joi.string().uri().allow('', null),
    text: Joi.string().allow('', null),
    order_num: Joi.number().integer().required()
});

const updateModuleSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    image_url: Joi.string().uri().allow('', null),
    video_url: Joi.string().uri().allow('', null),
    url: Joi.string().uri().allow('', null),
    text: Joi.string().allow('', null),
    order_num: Joi.number().integer()
}).min(1);

const createTopicSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    image_url: Joi.string().uri().allow('', null),
    video_url: Joi.string().uri().allow('', null),
    url: Joi.string().uri().allow('', null),
    text: Joi.string().allow('', null),
    order_num: Joi.number().integer().required()
});

const updateTopicSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    image_url: Joi.string().uri().allow('', null),
    video_url: Joi.string().uri().allow('', null),
    url: Joi.string().uri().allow('', null),
    text: Joi.string().allow('', null),
    order_num: Joi.number().integer()
}).min(1);

const createLessonSchema = Joi.object({
    name: Joi.string().required(),
    type: Joi.string().valid('video', 'text', 'image', 'mixed').required(),
    content_text: Joi.string().allow('', null),
    image_url: Joi.string().uri().allow('', null),
    video_url: Joi.string().uri().allow('', null),
    url: Joi.string().uri().allow('', null),
    text: Joi.string().allow('', null),
    duration_minutes: Joi.number().integer().allow(null),
    order_num: Joi.number().integer().required()
});

const updateLessonSchema = Joi.object({
    name: Joi.string(),
    type: Joi.string().valid('video', 'text', 'image', 'mixed'),
    content_text: Joi.string().allow('', null),
    image_url: Joi.string().uri().allow('', null),
    video_url: Joi.string().uri().allow('', null),
    url: Joi.string().uri().allow('', null),
    text: Joi.string().allow('', null),
    duration_minutes: Joi.number().integer().allow(null),
    order_num: Joi.number().integer()
}).min(1);

const enrollStudentSchema = Joi.object({
    student_id: Joi.number().integer().required(),
    batch_id: Joi.number().integer().required()
});

module.exports = {
    createCourseSchema,
    updateCourseSchema,
    createModuleSchema,
    updateModuleSchema,
    createTopicSchema,
    updateTopicSchema,
    createLessonSchema,
    updateLessonSchema,
    enrollStudentSchema
};
