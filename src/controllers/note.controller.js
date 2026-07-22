const noteService = require('../services/note.service');
const { createNoteSchema } = require('../utils/validations/course.validation');

class NoteController {
    // Helper to extract IDs and run service logic
    async _handleGetNotes(req, res, next, ids) {
        try {
            const note = await noteService.getNote(req.user.id, ids);
            res.status(200).json({ success: true, message: 'Note retrieved successfully', data: note });
        } catch (error) {
            next(error);
        }
    }

    async _handleCreateNote(req, res, next, ids) {
        try {
            const { error } = createNoteSchema.validate(req.body);
            if (error) {
                const validationError = new Error(error.details[0].message);
                validationError.statusCode = 400;
                throw validationError;
            }

            const note = await noteService.saveNote(req.user.id, ids, req.body);
            res.status(201).json({ success: true, message: 'Note saved successfully', data: note });
        } catch (error) {
            next(error);
        }
    }

    // --- Course Notes ---
    getCourseNotes = async (req, res, next) => {
        const { courseId } = req.params;
        await this._handleGetNotes(req, res, next, { courseId });
    };

    createCourseNote = async (req, res, next) => {
        const { courseId } = req.params;
        await this._handleCreateNote(req, res, next, { courseId });
    };

    updateCourseNote = async (req, res, next) => {
        const { courseId } = req.params;
        await this._handleCreateNote(req, res, next, { courseId });
    };

    // --- Module Notes ---
    getModuleNotes = async (req, res, next) => {
        const { courseId, moduleId } = req.params;
        await this._handleGetNotes(req, res, next, { courseId, moduleId });
    };

    createModuleNote = async (req, res, next) => {
        const { courseId, moduleId } = req.params;
        await this._handleCreateNote(req, res, next, { courseId, moduleId });
    };

    updateModuleNote = async (req, res, next) => {
        const { courseId, moduleId } = req.params;
        await this._handleCreateNote(req, res, next, { courseId, moduleId });
    };

    // --- Lesson Notes ---
    getLessonNotes = async (req, res, next) => {
        const { courseId, lessonId } = req.params;
        await this._handleGetNotes(req, res, next, { courseId, lessonId });
    };

    createLessonNote = async (req, res, next) => {
        const { courseId, lessonId } = req.params;
        await this._handleCreateNote(req, res, next, { courseId, lessonId });
    };

    updateLessonNote = async (req, res, next) => {
        const { courseId, lessonId } = req.params;
        await this._handleCreateNote(req, res, next, { courseId, lessonId });
    };

    // --- Topic Notes ---
    getTopicNotes = async (req, res, next) => {
        const { courseId, topicId } = req.params;
        await this._handleGetNotes(req, res, next, { courseId, topicId });
    };

    createTopicNote = async (req, res, next) => {
        const { courseId, topicId } = req.params;
        await this._handleCreateNote(req, res, next, { courseId, topicId });
    };

    updateTopicNote = async (req, res, next) => {
        const { courseId, topicId } = req.params;
        await this._handleCreateNote(req, res, next, { courseId, topicId });
    };
}

module.exports = new NoteController();
