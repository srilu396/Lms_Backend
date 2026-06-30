const { Assignment } = require('../src/models');
const courseService = require('../src/services/course.service');

async function run() {
    try {
        const modules = [];

        // Module 1: 6 lessons, each with 3 topics
        const module1Lessons = [];
        for (let l = 1; l <= 6; l++) {
            const topics = [];
            for (let t = 1; t <= 3; t++) {
                topics.push({
                    name: `Topic ${t} of Lesson ${l} (Module 1)`,
                    order_num: t,
                    content_text: 'Dummy topic content'
                });
            }
            module1Lessons.push({
                name: `Lesson ${l} (Module 1)`,
                type: 'text',
                order_num: l,
                topics,
                quizzes: [{ name: `Quiz for Lesson ${l}`, max_score: 100 }],
                assignments: [{ title: `Assignment for Lesson ${l}`, submission_type: 'text', max_score: 100 }]
            });
        }
        modules.push({
            name: 'Module 1: Introduction',
            order_num: 1,
            lessons: module1Lessons
        });

        // Modules 2, 3, 4, 5
        for (let m = 2; m <= 5; m++) {
            const modLessons = [];
            for (let l = 1; l <= 5; l++) {
                modLessons.push({
                    name: `Lesson ${l} (Module ${m})`,
                    type: 'text',
                    order_num: l,
                    quizzes: [{ name: `Quiz for Lesson ${l} Mod ${m}`, max_score: 100 }],
                    assignments: [{ title: `Assignment for Lesson ${l} Mod ${m}`, submission_type: 'file', max_score: 100 }]
                });
            }
            modules.push({
                name: `Module ${m}: Advanced Concepts`,
                order_num: m,
                lessons: modLessons
            });
        }

        const data = {
            name: 'Full Structured Course with Dummy Data',
            description: 'Created programmatically to test full nesting.',
            status: 'active',
            modules: modules,
            assignments: [],
            quizzes: []
        };

        console.log('Creating course with massive dummy data tree...');
        const created = await courseService.createCourse(data);
        console.log('Successfully created course ID:', created.id);

        // Add the final assignment directly using Assignment model
        console.log('Creating final course assignment...');
        await Assignment.create({
            title: 'Final Course Assignment',
            submission_type: 'file',
            max_score: 100,
            description: 'Final assessment for the entire course.',
            course_id: created.id
        });
        
        console.log('All done! You can check Course ID', created.id);
    } catch (e) {
        console.error('Error creating course:', e);
    }
}

run();
