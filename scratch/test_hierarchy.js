const courseService = require('../src/services/course.service');

async function seed() {
    try {
        const data = {
            name: 'Hierarchy Test Course',
            description: 'Course to verify new assignment hierarchy',
            status: 'draft',
            assignments: [
                { title: 'Course Level Assignment', submission_type: 'file', max_score: 100 }
            ],
            modules: [
                {
                    name: 'Module 1',
                    order_num: 1,
                    assignments: [
                        { title: 'Module Level Assignment', submission_type: 'text', max_score: 50 }
                    ],
                    lessons: [
                        {
                            name: 'Lesson 1',
                            type: 'text',
                            order_num: 1,
                            topics: [
                                {
                                    name: 'Topic 1',
                                    order_num: 1,
                                    assignments: [
                                        { title: 'Topic Level Assignment', submission_type: 'link', max_score: 25 }
                                    ],
                                    quizzes: [
                                        { name: 'Topic Level Quiz', status: 'published' }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        console.log('Seeding test course...');
        const created = await courseService.createCourse(data);
        console.log('Success! Course ID:', created.id);
        console.log('Course Assignments:', created.assignments.length);
        console.log('Module Assignments:', created.modules[0].assignments.length);
        console.log('Topic Assignments:', created.modules[0].lessons[0].topics[0].assignments.length);

    } catch (e) {
        console.error('Error seeding course:', e);
    }
}

seed();
