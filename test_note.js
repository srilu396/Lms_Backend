const noteService = require('./src/services/note.service');
const models = require('./src/models');

async function test() {
    try {
        console.log("Testing Topic Note Update...");
        const userId = 31;
        const courseId = 25;
        const topicId = 92;
        // First get
        let note = await noteService.getNote(userId, { courseId, topicId });
        console.log("Initial Note:", note?.toJSON());
        
        // Update
        const updated = await noteService.saveNote(userId, { courseId, topicId }, { content: "Updated topic note via script!" });
        console.log("Updated Note:", updated?.toJSON());

        // Second get
        note = await noteService.getNote(userId, { courseId, topicId });
        console.log("Final Note:", note?.toJSON());
    } catch (e) {
        console.error(e);
    }
}

test();
