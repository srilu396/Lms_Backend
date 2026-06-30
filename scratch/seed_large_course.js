const courseService = require('../src/services/course.service');

async function seed() {
    try {
        const modules = [];
        for (let i = 1; i <= 6; i++) {
            const lessons = [];
            for (let j = 1; j <= 3; j++) {
                const topics = [];
                for (let k = 1; k <= 2; k++) {
                    topics.push({
                        name: `Topic ${k} for Lesson ${j}, Mod ${i}`,
                        order_num: k,
                        description: 'Detailed topic content',
                        image_url: 'https://example.com/topic_img.png',
                        video_url: 'https://example.com/topic_video.mp4'
                    });
                }
                lessons.push({
                    name: `Lesson ${j} of Module ${i}`,
                    type: 'mixed',
                    order_num: j,
                    duration_minutes: 30,
                    image_url: 'https://example.com/lesson_img.png',
                    video_url: 'https://example.com/lesson_video.mp4',
                    topics: topics
                });
            }
            modules.push({
                name: `Module ${i}: Advanced Concepts`,
                order_num: i,
                description: 'This is a deep dive into the subject.',
                image_url: 'https://example.com/module_img.png',
                lessons: lessons
            });
        }

        const data = {
            name: 'Masterclass: 6-Module Comprehensive Course',
            description: 'A large course with 6 modules, lessons, topics, and media.',
            status: 'active',
            thumbnail_url: 'https://example.com/course_thumb.png',
            modules: modules
        };

        console.log('Seeding large course...');
        const created = await courseService.createCourse(data);
        console.log('Success! Course ID:', created.id);

    } catch (e) {
        console.error('Error seeding course:', e);
    }
}

seed();
