const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCurriculumSidebarPayload } = require('../src/services/course.service');

test('buildCurriculumSidebarPayload removes rich content and keeps sidebar summary fields', () => {
  const payload = buildCurriculumSidebarPayload({
    id: 1,
    name: 'Course A',
    description: 'A very long course description',
    modules: [
      {
        id: 10,
        name: 'Module One',
        description: 'A very long module description',
        content_blocks: [{ type: 'text', value: 'rich text chunk', order_num: 0 }],
        images: ['https://example.com/image.png'],
        videos: ['https://example.com/video.mp4'],
        pdfs: ['https://example.com/file.pdf'],
        urls: ['https://example.com/link'],
        order_num: 1,
        lessons: [
          {
            id: 20,
            name: 'Lesson One',
            type: 'text',
            description: 'A very long lesson description',
            content_blocks: [{ type: 'text', value: 'lesson rich text', order_num: 0 }],
            order_num: 1,
            topics: [
              {
                id: 30,
                name: 'Topic One',
                description: 'A very long topic description',
                content_blocks: [{ type: 'text', value: 'topic rich text', order_num: 0 }],
                order_num: 1
              }
            ]
          }
        ]
      }
    ]
  });

  assert.equal(payload.name, 'Course A');
  assert.equal(payload.description, undefined);
  assert.equal(payload.modules[0].description, undefined);
  assert.equal(payload.modules[0].content_blocks, undefined);
  assert.equal(payload.modules[0].images, undefined);
  assert.equal(payload.modules[0].lessons[0].topics[0].description, undefined);
  assert.deepEqual(payload.modules[0].lessons[0].topics[0], {
    id: 30,
    name: 'Topic One',
    order_num: 1
  });
});

test('buildCurriculumSidebarPayload appends a lightweight final assessment node when configured', () => {
  const payload = buildCurriculumSidebarPayload({
    id: 2,
    name: 'Course B',
    modules: [],
    final_assessment_id: 55,
    final_assessment_title: 'Final Project',
    final_assessment_type: 'assignment',
    final_assessment_order_num: 9999,
    final_assessment_unique_code: 'FA-001'
  });

  assert.deepEqual(payload.final_assessment, {
    id: 55,
    title: 'Final Project',
    type: 'assignment',
    order_num: 9999,
    unique_code: 'FA-001'
  });
});
