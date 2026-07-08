const Joi = require('joi');

const createLessonSchema = Joi.object({
    name: Joi.string().required(),
    type: Joi.string().valid('video', 'text', 'image', 'mixed').required(),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: Joi.string().uri().allow('', null),
    video_url: Joi.string().uri().allow('', null),
    url: Joi.string().uri().allow('', null),
    duration_minutes: Joi.number().integer().allow(null),
    order_num: Joi.number().integer().required(),
    assignments: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true))),
    quizzes: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true)))
});

const createTopicSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: Joi.string().uri().allow('', null),
    video_url: Joi.string().uri().allow('', null),
    url: Joi.string().uri().allow('', null),
    order_num: Joi.number().integer().required(),
    lessons: Joi.array().items(createLessonSchema),
    assignments: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true))),
    quizzes: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true)))
});

const createModuleSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: Joi.string().uri().allow('', null),
    video_url: Joi.string().uri().allow('', null),
    url: Joi.string().uri().allow('', null),
    order_num: Joi.number().integer().required(),
    is_locked: Joi.boolean().allow(null),
    created_at: Joi.any().allow(null),
    topics: Joi.array().items(createTopicSchema),
    assignments: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true))),
    quizzes: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true)))
});

const createCourseSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    thumbnail_url: Joi.string().uri().allow('', null),
    institution_id: Joi.number().integer().allow(null),
    status: Joi.string().valid('active', 'inactive', 'archived', 'draft'),
    modules: Joi.array().items(createModuleSchema),
    assignments: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true))).min(1).required(),
    quizzes: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true)))
});

const updateCourseSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow('', null),
    thumbnail_url: Joi.string().uri().allow('', null),
    institution_id: Joi.number().integer().allow(null),
    status: Joi.string().valid('active', 'inactive', 'archived', 'draft'),
    assignments: Joi.array().items(Joi.number().integer()),
    quizzes: Joi.array().items(Joi.number().integer())
}).min(1);

const updateModuleSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: Joi.string().uri().allow('', null),
    video_url: Joi.string().uri().allow('', null),
    url: Joi.string().uri().allow('', null),
    order_num: Joi.number().integer(),
    is_locked: Joi.boolean().allow(null),
    assignments: Joi.array().items(Joi.number().integer()),
    quizzes: Joi.array().items(Joi.number().integer())
}).min(1);

const updateTopicSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: Joi.string().uri().allow('', null),
    video_url: Joi.string().uri().allow('', null),
    url: Joi.string().uri().allow('', null),
    order_num: Joi.number().integer(),
    assignments: Joi.array().items(Joi.number().integer()),
    quizzes: Joi.array().items(Joi.number().integer())
}).min(1);

const updateLessonSchema = Joi.object({
    name: Joi.string(),
    type: Joi.string().valid('video', 'text', 'image', 'mixed'),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: Joi.string().uri().allow('', null),
    video_url: Joi.string().uri().allow('', null),
    url: Joi.string().uri().allow('', null),
    duration_minutes: Joi.number().integer().allow(null),
    order_num: Joi.number().integer(),
    assignments: Joi.array().items(Joi.number().integer()),
    quizzes: Joi.array().items(Joi.number().integer())
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
