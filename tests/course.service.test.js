const test = require('node:test');
const assert = require('node:assert/strict');
const { buildCourseMetadataPayload } = require('../src/services/course.service');

test('buildCourseMetadataPayload keeps only basic course metadata', () => {
  const input = {
    id: 7,
    name: 'Advanced Backend',
    description: 'Course description',
    domain_id: 3,
    institution_id: 12,
    thumbnail_url: 'https://cdn.example.com/cover.jpg',
    status: 'active',
    unique_code: 'CRS-ABC123',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    modules: [{ id: 1, lessons: [{ id: 2, topics: [{ id: 3 }] }] }],
    content_blocks: [{ type: 'text', value: 'secret' }],
    images: ['img1'],
    videos: ['vid1'],
    pdfs: ['pdf1'],
    urls: ['https://example.com']
  };

  const result = buildCourseMetadataPayload(input);

  assert.deepEqual(result, {
    id: 7,
    name: 'Advanced Backend',
    description: 'Course description',
    domain_id: 3,
    institution_id: 12,
    thumbnail_url: 'https://cdn.example.com/cover.jpg',
    status: 'active',
    unique_code: 'CRS-ABC123',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z'
  });
});

test('buildCourseMetadataPayload preserves course config fields and final assessment references', () => {
  const input = {
    id: 8,
    name: 'Course Config',
    description: 'Course description',
    thumbnail_url: 'https://cdn.example.com/cover.jpg',
    domain_id: 3,
    domain_name: 'Science',
    institution_id: 12,
    tags: ['backend', 'node'],
    final_assessment_id: 22,
    final_assessment_type: 'quiz',
    status: 'draft',
    unique_code: 'CRS-XYZ789',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
    modules: [{ id: 1 }],
    assignments: [{ id: 99 }],
    quizzes: [{ id: 1 }]
  };

  const result = buildCourseMetadataPayload(input);

  assert.deepEqual(result, {
    id: 8,
    name: 'Course Config',
    description: 'Course description',
    thumbnail_url: 'https://cdn.example.com/cover.jpg',
    domain_id: 3,
    domain_name: 'Science',
    institution_id: 12,
    tags: ['backend', 'node'],
    final_assessment_id: 22,
    final_assessment_type: 'quiz',
    status: 'draft',
    unique_code: 'CRS-XYZ789',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z'
  });
});
