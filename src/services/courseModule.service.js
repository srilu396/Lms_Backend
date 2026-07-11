const { Module, Course, Assignment, Quiz, Topic, Lesson, MediaAttachment, sequelize } = require('../models');
const { handleContentSync, prepareEntityDbData, mediaInclude, serializeWithMedia } = require('../utils/media');

class ModuleService {
    async createModule(courseId, data) {
        return await sequelize.transaction(async (transaction) => {
            if (data.quiz_ids !== undefined && data.quizzes === undefined) {
                data.quizzes = data.quiz_ids;
            }
            const { assignment_ids, quizzes, ...moduleData } = data;
            
            const course = await Course.findByPk(courseId, { transaction });
            if (!course) {
                const error = new Error('Course not found');
                error.statusCode = 404;
                throw error;
            }

            // Remove created_at if passed to let Sequelize handle it
            delete moduleData.created_at;

            // Prepare DB data and sync legacy columns from content_blocks
            const dbData = prepareEntityDbData(moduleData);

            const mod = await Module.create({ ...dbData, course_id: courseId }, { transaction });

            // Sync content blocks / media attachments
            await handleContentSync('module', mod.id, data, transaction);

            // Link existing assignments
            if (assignment_ids && Array.isArray(assignment_ids)) {
                await Assignment.update(
                    { module_id: mod.id, course_id: courseId },
                    { where: { id: assignment_ids }, transaction }
                );
            }

            // Link existing quizzes
            if (quizzes && Array.isArray(quizzes)) {
                await Quiz.update(
                    { module_id: mod.id, course_id: courseId },
                    { where: { id: quizzes }, transaction }
                );
            }

            return await this._reloadModule(mod, transaction);
        });
    }

    async updateModule(moduleId, data) {
        return await sequelize.transaction(async (transaction) => {
            if (data.quiz_ids !== undefined && data.quizzes === undefined) {
                data.quizzes = data.quiz_ids;
            }
            const { assignment_ids, quizzes, ...moduleData } = data;
            const mod = await Module.findByPk(moduleId, { transaction });
            if (!mod) {
                const error = new Error('Module not found');
                error.statusCode = 404;
                throw error;
            }

            delete moduleData.created_at;

            // Prepare DB data and sync legacy columns from content_blocks
            const dbData = prepareEntityDbData(moduleData);

            await mod.update(dbData, { transaction });

            // Sync content blocks / media attachments
            await handleContentSync('module', mod.id, data, transaction);

            // Link existing assignments
            if (assignment_ids !== undefined) {
                await Assignment.update(
                    { module_id: null, course_id: null },
                    { where: { module_id: mod.id }, transaction }
                );
                if (Array.isArray(assignment_ids) && assignment_ids.length > 0) {
                    await Assignment.update(
                        { module_id: mod.id, course_id: mod.course_id },
                        { where: { id: assignment_ids }, transaction }
                    );
                }
            }

            // Link existing quizzes
            if (quizzes !== undefined) {
                await Quiz.update(
                    { module_id: null, course_id: null },
                    { where: { module_id: mod.id }, transaction }
                );
                if (Array.isArray(quizzes) && quizzes.length > 0) {
                    await Quiz.update(
                        { module_id: mod.id, course_id: mod.course_id },
                        { where: { id: quizzes }, transaction }
                    );
                }
            }

            return await this._reloadModule(mod, transaction);
        });
    }

    async deleteModule(moduleId) {
        const mod = await Module.findByPk(moduleId);
        if (!mod) {
            const error = new Error('Module not found');
            error.statusCode = 404;
            throw error;
        }
        await mod.destroy();
        return true;
    }

    async _reloadModule(mod, transaction = null) {
        const reloaded = await mod.reload({
            include: [
                { model: Assignment, as: 'assignments' },
                { model: Quiz, as: 'quizzes' },
                mediaInclude(),
                {
                    model: Lesson,
                    as: 'lessons',
                    include: [
                        { model: Assignment, as: 'assignments' },
                        { model: Quiz, as: 'quizzes' },
                        mediaInclude(),
                        {
                            model: Topic,
                            as: 'topics',
                            include: [mediaInclude()]
                        }
                    ]
                }
            ],
            transaction
        });

        const json = reloaded.toJSON();
        return serializeModuleWithMedia(json);
    }
}

/**
 * Strip media array values before writing to legacy VARCHAR columns.
 * Legacy columns store only a single URL string (backward compat).
 */
function stripMediaArrays(data) {
    const result = { ...data };
    for (const field of ['image_url', 'video_url', 'pdf_url', 'url']) {
        if (field in result) {
            if (Array.isArray(result[field])) {
                // Write the first value to the legacy column (fallback for old clients)
                result[field] = result[field][0] || null;
            }
        }
    }
    return result;
}

/**
 * Recursively serialize a module JSON with grouped media arrays.
 */
function serializeModuleWithMedia(moduleJson) {
    const mod = serializeWithMedia(moduleJson);
    if (mod.lessons) {
        mod.lessons = mod.lessons.map(l => {
            const les = serializeWithMedia(l);
            if (les.topics) {
                les.topics = les.topics.map(t => serializeWithMedia(t));
            }
            return les;
        });
    }
    return mod;
}

module.exports = new ModuleService();
module.exports.stripMediaArrays = stripMediaArrays;
module.exports.serializeModuleWithMedia = serializeModuleWithMedia;
