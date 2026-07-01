const Joi = require('joi');

// We strictly disallow role, id, created_at, status, allocated_batches updates via this endpoint.
// They must be updated by admins via specific endpoints.
const baseProfileSchema = {
    name: Joi.string().min(2).max(100).optional(), // Sometimes clients send 'name' instead of 'full_name'
    full_name: Joi.string().min(2).max(100).optional(),
    username: Joi.string().min(1).optional(),
    phone_number: Joi.string().pattern(/^\+?[0-9]{10,15}$/).allow(null, '').optional(),
    designation: Joi.string().min(1).max(100).allow(null, '').optional(),
    avatar_url: Joi.string().uri().allow(null, '').optional(),
    bio: Joi.string().allow(null, '').optional() // Common for tutors/students
};

const adminUpdateProfileSchema = Joi.object({
    ...baseProfileSchema
}).unknown(false);

const tutorUpdateProfileSchema = Joi.object({
    ...baseProfileSchema
}).unknown(false);

const studentUpdateProfileSchema = Joi.object({
    ...baseProfileSchema
}).unknown(false);

const instRepUpdateProfileSchema = Joi.object({
    ...baseProfileSchema
}).unknown(false);

module.exports = {
    adminUpdateProfileSchema,
    tutorUpdateProfileSchema,
    studentUpdateProfileSchema,
    instRepUpdateProfileSchema
};
