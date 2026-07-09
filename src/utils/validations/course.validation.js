const Joi = require('joi');

const createTopicSchema = Joi.object({
    id: Joi.number().integer().allow(null),
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: Joi.string().allow('', null),
    video_url: Joi.string().allow('', null),
    url: Joi.string().allow('', null),
    pdf_url: Joi.string().allow('', null),
    order_num: Joi.number().integer().required()
});

const createLessonSchema = Joi.object({
    id: Joi.number().integer().allow(null),
    name: Joi.string().required(),
    type: Joi.string().valid('video', 'text', 'image', 'mixed').required(),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: Joi.string().allow('', null),
    video_url: Joi.string().allow('', null),
    url: Joi.string().allow('', null),
    pdf_url: Joi.string().allow('', null),
    duration_minutes: Joi.number().integer().allow(null),
    order_num: Joi.number().integer().required(),
    topics: Joi.array().items(createTopicSchema),
    assignment_ids: Joi.array().items(Joi.number().integer()).allow(null),
    quizzes: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true))).allow(null),
    quiz_ids: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true))).allow(null)
});

const createModuleSchema = Joi.object({
    id: Joi.number().integer().allow(null),
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: Joi.string().allow('', null),
    video_url: Joi.string().allow('', null),
    url: Joi.string().allow('', null),
    pdf_url: Joi.string().allow('', null),
    order_num: Joi.number().integer().required(),
    is_locked: Joi.boolean().allow(null),
    created_at: Joi.any().allow(null),
    lessons: Joi.array().items(createLessonSchema),
    assignment_ids: Joi.array().items(Joi.number().integer()).allow(null),
    quizzes: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true))).allow(null),
    quiz_ids: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true))).allow(null)
});

const createCourseSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    thumbnail_url: Joi.string().allow('', null),
    status: Joi.string().valid('active', 'inactive', 'archived', 'draft', 'published'),
    modules: Joi.array().items(createModuleSchema),
    assignment_ids: Joi.array().items(Joi.number().integer()).max(1).allow(null),
    // Course does not support quizzes — only Final Assignment is allowed
    quiz_ids: Joi.forbidden(),
    quizzes: Joi.forbidden()
});

const updateCourseSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow('', null),
    thumbnail_url: Joi.string().allow('', null),
    status: Joi.string().valid('active', 'inactive', 'archived', 'draft', 'published'),
    assignment_ids: Joi.array().items(Joi.number().integer()).max(1).allow(null),
    modules: Joi.array().items(createModuleSchema),
    // Course does not support quizzes — only Final Assignment is allowed
    quiz_ids: Joi.forbidden(),
    quizzes: Joi.forbidden()
}).min(1);

const updateModuleSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: Joi.string().allow('', null),
    video_url: Joi.string().allow('', null),
    url: Joi.string().allow('', null),
    pdf_url: Joi.string().allow('', null),
    order_num: Joi.number().integer(),
    is_locked: Joi.boolean().allow(null),
    assignment_ids: Joi.array().items(Joi.number().integer()).allow(null),
    quizzes: Joi.array().items(Joi.number().integer()).allow(null),
    quiz_ids: Joi.array().items(Joi.number().integer()).allow(null)
}).min(1);

const updateTopicSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: Joi.string().allow('', null),
    video_url: Joi.string().allow('', null),
    url: Joi.string().allow('', null),
    pdf_url: Joi.string().allow('', null),
    order_num: Joi.number().integer()
}).min(1);

const updateLessonSchema = Joi.object({
    name: Joi.string(),
    type: Joi.string().valid('video', 'text', 'image', 'mixed'),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: Joi.string().allow('', null),
    video_url: Joi.string().allow('', null),
    url: Joi.string().allow('', null),
    pdf_url: Joi.string().allow('', null),
    duration_minutes: Joi.number().integer().allow(null),
    order_num: Joi.number().integer(),
    assignment_ids: Joi.array().items(Joi.number().integer()).allow(null),
    quizzes: Joi.array().items(Joi.number().integer()).allow(null),
    quiz_ids: Joi.array().items(Joi.number().integer()).allow(null)
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
