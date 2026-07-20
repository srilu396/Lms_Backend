const Joi = require('joi');

// Media safety limits
const IMAGE_LIMIT = 10;
const VIDEO_LIMIT = 10;
const PDF_LIMIT   = 10;
const URL_LIMIT   = 20;

// Accepts: single string | array of strings | null | ''
// Enforces a per-type max count for arrays
const mediaField = (limit) => Joi.alternatives().try(
    Joi.string().allow('', null),
    Joi.array().items(Joi.string().uri({ allowRelative: true }).allow('', null)).max(limit).allow(null)
);

const BLOCKS_LIMIT = 100;

const contentBlockSchema = Joi.object({
    id: Joi.number().integer().allow(null),
    type: Joi.string().valid('text', 'image', 'video', 'pdf', 'url').required(),
    value: Joi.string().required().when('type', {
        is: Joi.string().valid('image', 'video', 'pdf', 'url'),
        then: Joi.string().uri({ allowRelative: true }).allow('', null),
        otherwise: Joi.string().allow('', null)
    }),
    order_num: Joi.number().integer().required()
});

const createTopicSchema = Joi.object({
    id: Joi.number().integer().allow(null),
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: mediaField(IMAGE_LIMIT),
    video_url: mediaField(VIDEO_LIMIT),
    url: mediaField(URL_LIMIT),
    pdf_url: mediaField(PDF_LIMIT),
    order_num: Joi.number().integer().required(),
    content_blocks: Joi.array().items(contentBlockSchema).max(BLOCKS_LIMIT).unique('order_num').allow(null)
});

const createLessonSchema = Joi.object({
    id: Joi.number().integer().allow(null),
    name: Joi.string().required(),
    type: Joi.string().valid('video', 'text', 'image', 'mixed').required(),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: mediaField(IMAGE_LIMIT),
    video_url: mediaField(VIDEO_LIMIT),
    url: mediaField(URL_LIMIT),
    pdf_url: mediaField(PDF_LIMIT),
    duration_minutes: Joi.number().integer().allow(null),
    order_num: Joi.number().integer().required(),
    topics: Joi.array().items(createTopicSchema),
    assignment_ids: Joi.array().items(Joi.number().integer()).allow(null),
    quizzes: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true))).allow(null),
    quiz_ids: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true))).allow(null),
    content_blocks: Joi.array().items(contentBlockSchema).max(BLOCKS_LIMIT).unique('order_num').allow(null)
});

const createModuleSchema = Joi.object({
    id: Joi.number().integer().allow(null),
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: mediaField(IMAGE_LIMIT),
    video_url: mediaField(VIDEO_LIMIT),
    url: mediaField(URL_LIMIT),
    pdf_url: mediaField(PDF_LIMIT),
    order_num: Joi.number().integer().required(),
    is_locked: Joi.boolean().allow(null),
    created_at: Joi.any().allow(null),
    lessons: Joi.array().items(createLessonSchema),
    assignment_ids: Joi.array().items(Joi.number().integer()).allow(null),
    quizzes: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true))).allow(null),
    quiz_ids: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true))).allow(null),
    content_blocks: Joi.array().items(contentBlockSchema).max(BLOCKS_LIMIT).unique('order_num').allow(null)
});

const createCourseSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().allow('', null),
    thumbnail_url: Joi.string().allow('', null),
    domain_id: Joi.number().integer().allow(null),
    institution_id: Joi.number().integer().allow(null),
    tags: Joi.array().items(Joi.string()).allow(null),
    final_assessment_id: Joi.number().integer().allow(null),
    final_assessment_type: Joi.string().valid('assignment', 'quiz').allow(null),
    status: Joi.string().valid('active', 'inactive', 'archived', 'draft', 'published'),
    modules: Joi.array().items(createModuleSchema),
    assignment_ids: Joi.array().items(Joi.number().integer()).max(1).allow(null),
    quiz_ids: Joi.array().items(Joi.number().integer()).max(1).allow(null),
    quizzes: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true))).allow(null)
});

const updateCourseSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow('', null),
    thumbnail_url: Joi.string().allow('', null),
    domain_id: Joi.number().integer().allow(null),
    institution_id: Joi.number().integer().allow(null),
    tags: Joi.array().items(Joi.string()).allow(null),
    final_assessment_id: Joi.number().integer().allow(null),
    final_assessment_type: Joi.string().valid('assignment', 'quiz').allow(null),
    status: Joi.string().valid('active', 'inactive', 'archived', 'draft', 'published'),
    assignment_ids: Joi.array().items(Joi.number().integer()).max(1).allow(null),
    quiz_ids: Joi.array().items(Joi.number().integer()).max(1).allow(null),
    modules: Joi.array().items(createModuleSchema),
    quizzes: Joi.array().items(Joi.alternatives().try(Joi.number().integer(), Joi.object().unknown(true))).allow(null)
}).min(1);

const updateModuleSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: mediaField(IMAGE_LIMIT),
    video_url: mediaField(VIDEO_LIMIT),
    url: mediaField(URL_LIMIT),
    pdf_url: mediaField(PDF_LIMIT),
    order_num: Joi.number().integer(),
    is_locked: Joi.boolean().allow(null),
    assignment_ids: Joi.array().items(Joi.number().integer()).allow(null),
    quizzes: Joi.array().items(Joi.number().integer()).allow(null),
    quiz_ids: Joi.array().items(Joi.number().integer()).allow(null),
    content_blocks: Joi.array().items(contentBlockSchema).max(BLOCKS_LIMIT).unique('order_num').allow(null)
}).min(1);

const updateTopicSchema = Joi.object({
    name: Joi.string(),
    description: Joi.string().allow('', null),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: mediaField(IMAGE_LIMIT),
    video_url: mediaField(VIDEO_LIMIT),
    url: mediaField(URL_LIMIT),
    pdf_url: mediaField(PDF_LIMIT),
    order_num: Joi.number().integer(),
    content_blocks: Joi.array().items(contentBlockSchema).max(BLOCKS_LIMIT).unique('order_num').allow(null)
}).min(1);

const updateLessonSchema = Joi.object({
    name: Joi.string(),
    type: Joi.string().valid('video', 'text', 'image', 'mixed'),
    content_text: Joi.string().allow('', null),
    text: Joi.string().allow('', null),
    image_url: mediaField(IMAGE_LIMIT),
    video_url: mediaField(VIDEO_LIMIT),
    url: mediaField(URL_LIMIT),
    pdf_url: mediaField(PDF_LIMIT),
    duration_minutes: Joi.number().integer().allow(null),
    order_num: Joi.number().integer(),
    assignment_ids: Joi.array().items(Joi.number().integer()).allow(null),
    quizzes: Joi.array().items(Joi.number().integer()).allow(null),
    quiz_ids: Joi.array().items(Joi.number().integer()).allow(null),
    content_blocks: Joi.array().items(contentBlockSchema).max(BLOCKS_LIMIT).unique('order_num').allow(null)
}).min(1);

const enrollStudentSchema = Joi.object({
    student_id: Joi.number().integer().required(),
    batch_id: Joi.number().integer().required()
});

const createNoteSchema = Joi.object({
    title: Joi.string().max(255).allow('', null),
    content: Joi.string().required(),
    timestamp: Joi.string().allow('', null),
    type: Joi.string().valid('general', 'timestamped').default('general')
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
    enrollStudentSchema,
    createNoteSchema
};
