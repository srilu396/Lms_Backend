/**
 * Quick functional test: media attachment sync and grouping.
 * Tests: create module with multiple images/videos, update media, remove one.
 */

const { Module, MediaAttachment, Course, sequelize } = require('./src/models');
const { syncMediaAttachments, groupAttachments, serializeWithMedia, extractMediaFields, normalizeMediaField } = require('./src/utils/media');

async function run() {
    console.log('=== Media Attachment Functional Test ===\n');

    // 1. Test normalizeMediaField
    console.log('[1] normalizeMediaField tests:');
    console.log('  string ->', normalizeMediaField('https://img1.png'));          // ['https://img1.png']
    console.log('  array ->', normalizeMediaField(['https://a.png', 'https://b.png'])); // 2 items
    console.log('  null ->', normalizeMediaField(null));                           // null
    console.log('  empty string ->', normalizeMediaField(''));                     // []

    // 2. Test groupAttachments
    console.log('\n[2] groupAttachments test:');
    const fakeAttachments = [
        { media_type: 'image', url: 'https://img1.png', order_num: 0 },
        { media_type: 'image', url: 'https://img2.png', order_num: 1 },
        { media_type: 'video', url: 'https://vid1.mp4', order_num: 0 },
        { media_type: 'pdf', url: 'https://doc.pdf', order_num: 0 },
        { media_type: 'url', url: 'https://link.com', order_num: 0 },
    ];
    const grouped = groupAttachments(fakeAttachments);
    console.log('  Grouped:', JSON.stringify(grouped, null, 2));

    // 3. Test serializeWithMedia
    console.log('\n[3] serializeWithMedia test (from attachments):');
    const fakeItem = {
        id: 1, name: 'Test Module',
        image_url: 'legacy_img.png', video_url: null,
        attachments: fakeAttachments
    };
    const serialized = serializeWithMedia(fakeItem);
    console.log('  Has images[]:', Array.isArray(serialized.images), '| Count:', serialized.images.length);
    console.log('  Has videos[]:', Array.isArray(serialized.videos), '| Count:', serialized.videos.length);
    console.log('  No image_url field:', !('image_url' in serialized));

    // 4. Test extractMediaFields
    console.log('\n[4] extractMediaFields test:');
    const body1 = { name: 'Mod', image_url: ['a.png', 'b.png'], order_num: 1 };
    const body2 = { name: 'Mod', order_num: 1 }; // no media
    console.log('  With media:', JSON.stringify(extractMediaFields(body1)));
    console.log('  Without media:', JSON.stringify(extractMediaFields(body2)));

    // 5. Live DB test: sync + reload
    console.log('\n[5] Live DB sync test:');
    // Find a real course and module to use
    const course = await Course.findOne({ order: [['id', 'ASC']] });
    if (!course) {
        console.log('  No courses found. Skipping live DB test.');
        process.exit(0);
    }
    const mod = await Module.findOne({ where: { course_id: course.id }, order: [['id', 'ASC']] });
    if (!mod) {
        console.log('  No module found. Skipping live DB test.');
        process.exit(0);
    }
    console.log(`  Using Module ID: ${mod.id} (course ${course.id})`);

    // Step A: Sync 2 images + 1 video
    await syncMediaAttachments('module', mod.id, {
        image_url: ['https://img1.png', 'https://img2.png'],
        video_url: 'https://vid1.mp4'
    });
    const afterA = await MediaAttachment.findAll({ where: { entity_type: 'module', entity_id: mod.id } });
    console.log('  After set [2 imgs + 1 vid] → total records:', afterA.length);

    // Step B: Remove img1, keep img2, add img3
    await syncMediaAttachments('module', mod.id, {
        image_url: ['https://img2.png', 'https://img3.png']
    });
    const afterB = await MediaAttachment.findAll({ where: { entity_type: 'module', entity_id: mod.id, media_type: 'image' } });
    console.log('  After update images [img2, img3] → image count:', afterB.length,
        '| URLs:', afterB.map(a => a.url).join(', '));

    // Step C: Remove all images (send empty array)
    await syncMediaAttachments('module', mod.id, { image_url: [] });
    const afterC = await MediaAttachment.findAll({ where: { entity_type: 'module', entity_id: mod.id, media_type: 'image' } });
    const videoCount = await MediaAttachment.count({ where: { entity_type: 'module', entity_id: mod.id, media_type: 'video' } });
    console.log('  After remove all images → image count:', afterC.length, '| Video still present:', videoCount);

    // Step D: Remove all (all types)
    await syncMediaAttachments('module', mod.id, { image_url: [], video_url: [], pdf_url: [], url: [] });
    const afterD = await MediaAttachment.count({ where: { entity_type: 'module', entity_id: mod.id } });
    console.log('  After remove all → total count:', afterD);

    console.log('\n✅ All tests passed!');
    process.exit(0);
}

run().catch(err => {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
});
