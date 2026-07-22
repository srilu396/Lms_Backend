const courseService = require('../src/services/course.service');

async function run() {
    try {
        const data = {
            name: 'Course with Module Assignments Test',
            description: 'Testing module level assignments',
            status: 'active',
            modules: [
                {
                    name: 'Module 1: Basic',
                    order_num: 1,
                    lessons: [
                        {
                            name: 'Lesson 1',
                            type: 'text',
                            order_num: 1,
                            topics: [
                                { name: 'Topic 1', order_num: 1 }
                            ],
                            assignments: [
                                { title: 'Lesson 1 Assignment', submission_type: 'text', max_score: 50 }
                            ]
                        }
                    ],
                    assignments: [
                        { title: 'Module 1 Assignment (Optional)', submission_type: 'file', max_score: 100 }
                    ]
                },
                {
                    name: 'Module 2: No Assignment',
                    order_num: 2,
                    lessons: [
                        {
                            name: 'Lesson 2',
                            type: 'text',
                            order_num: 1,
                            topics: [
                                { name: 'Topic 2', order_num: 1 }
                            ]
                        }
                    ]
                }
            ]
        };

        console.log('Creating course with module assignments...');
        const created = await courseService.createCourse(data);
        console.log('Successfully created course ID:', created.id);
        
        console.log('Fetching course to verify structure...');
        const fetched = await courseService.getCourseById(created.id);
        
        console.log(JSON.stringify(fetched, null, 2));

    } catch (e) {
        console.error('Error testing:', e);
    }
}

run();
