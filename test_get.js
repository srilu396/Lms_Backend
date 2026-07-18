const noteService = require('./src/services/note.service');
const models = require('./src/models');

async function test() {
    try {
        console.log("Testing GET Course Note...");
        const userId = 31;
        const courseId = 25;
        // First get
        let note = await noteService.getNote(userId, { courseId });
        console.log("Current Note:", note?.toJSON());
        
    } catch (e) {
        console.error(e);
    }
}

test();
