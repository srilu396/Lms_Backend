/**
 * Media Attachment Utility
 *
 * Handles polymorphic media attachment synchronization for Modules, Lessons, and Topics.
 * Media types: 'image', 'video', 'pdf', 'url', 'text'
 * Entity types: 'module', 'lesson', 'topic'
 */

const { MediaAttachment } = require('../models');

const MEDIA_TYPES = ['image', 'video', 'pdf', 'url', 'text'];

/**
 * Normalize a media field value to an array of non-empty strings.
 * Accepts: string | string[] | null | undefined
 */
function normalizeMediaField(value) {
    if (value === null || value === undefined || value === '') return null; // null means "don't touch"
    if (Array.isArray(value)) {
        const filtered = value.filter(u => typeof u === 'string' && u.trim() !== '');
        return filtered; // empty array means "remove all"
    }
    if (typeof value === 'string' && value.trim() !== '') {
        return [value.trim()];
    }
    return []; // empty string means "remove all"
}

/**
 * Intelligently sync media attachments for an entity.
 * Only updates types that are explicitly provided in mediaFields.
 * Performs add/remove/reorder as a delta diff — does NOT delete all and re-insert.
 *
 * @param {string} entityType - 'module' | 'lesson' | 'topic'
 * @param {number} entityId
 * @param {Object} mediaFields - { image_url, video_url, pdf_url, url } — only provided fields are synced
 * @param {Object|null} transaction - Sequelize transaction
 */
async function syncMediaAttachments(entityType, entityId, mediaFields, transaction = null) {
    const mediaTypeMap = {
        image_url: 'image',
        video_url: 'video',
        pdf_url: 'pdf',
        url: 'url'
    };

    for (const [fieldName, mediaType] of Object.entries(mediaTypeMap)) {
        // Only sync if this field was explicitly present in the request
        if (!(fieldName in mediaFields)) continue;

        const normalized = normalizeMediaField(mediaFields[fieldName]);

        // null means "field not present in request" — skip
        // We already checked `fieldName in mediaFields`, so normalized can be [] or [...]
        const requestedUrls = normalized === null ? [] : normalized;

        // Load existing records for this entity + media_type
        const existing = await MediaAttachment.findAll({
            where: { entity_type: entityType, entity_id: entityId, media_type: mediaType },
            order: [['order_num', 'ASC']],
            transaction
        });

        const existingUrls = existing.map(a => a.url);
        const existingMap = new Map(existing.map(a => [a.url, a]));

        // Determine what to delete: in DB but not in requested list
        const toDelete = existing.filter(a => !requestedUrls.includes(a.url));
        for (const record of toDelete) {
            await record.destroy({ transaction });
        }

        // Determine what to insert or reorder
        for (let i = 0; i < requestedUrls.length; i++) {
            const url = requestedUrls[i];
            if (existingMap.has(url)) {
                // Already exists — update order_num if changed
                const record = existingMap.get(url);
                if (record.order_num !== i) {
                    await record.update({ order_num: i }, { transaction });
                }
            } else {
                // New URL — insert
                await MediaAttachment.create({
                    entity_type: entityType,
                    entity_id: entityId,
                    media_type: mediaType,
                    url,
                    order_num: i
                }, { transaction });
            }
        }
    }
}

/**
 * Diff-based synchronization for content blocks.
 * Validates that incoming block IDs belong to the current entity before updating.
 * Updates order/values, inserts new blocks, and removes omitted blocks.
 *
 * @param {string} entityType - 'module' | 'lesson' | 'topic'
 * @param {number} entityId
 * @param {Array} contentBlocks - Array of { id?, type, value, order_num }
 * @param {Object|null} transaction - Sequelize transaction
 */
async function syncContentBlocks(entityType, entityId, contentBlocks, transaction = null) {
    if (!contentBlocks) return;

    // 1. Fetch all existing attachments for this entity
    const existing = await MediaAttachment.findAll({
        where: { entity_type: entityType, entity_id: entityId },
        transaction
    });

    const existingMap = new Map(existing.map(a => [a.id, a]));

    // 2. Validate that incoming block IDs belong to the current entity
    for (const block of contentBlocks) {
        if (block.id) {
            const match = existingMap.get(block.id);
            if (!match) {
                const error = new Error(`Content block ID ${block.id} does not belong to this ${entityType}`);
                error.statusCode = 400;
                throw error;
            }
        }
    }

    const incomingIds = new Set(contentBlocks.map(b => b.id).filter(Boolean));

    // 3. Delete existing records that are not in the incoming list
    const toDelete = existing.filter(a => !incomingIds.has(a.id));
    for (const record of toDelete) {
        await record.destroy({ transaction });
    }

    // 4. Update existing blocks and insert new ones
    for (let i = 0; i < contentBlocks.length; i++) {
        const block = contentBlocks[i];
        const mediaType = block.type;
        const isText = mediaType === 'text';
        const urlValue = isText ? null : block.value;
        const contentValue = isText ? block.value : null;

        if (block.id) {
            // Update existing record
            const record = existingMap.get(block.id);
            await record.update({
                media_type: mediaType,
                url: urlValue,
                content: contentValue,
                order_num: block.order_num !== undefined ? block.order_num : i
            }, { transaction });
        } else {
            // Insert new record
            await MediaAttachment.create({
                entity_type: entityType,
                entity_id: entityId,
                media_type: mediaType,
                url: urlValue,
                content: contentValue,
                order_num: block.order_num !== undefined ? block.order_num : i
            }, { transaction });
        }
    }
}

/**
 * Route content synchronization to either new diff-sync or legacy sync.
 */
async function handleContentSync(entityType, entityId, data, transaction = null) {
    if (data.content_blocks !== undefined && data.content_blocks !== null) {
        await syncContentBlocks(entityType, entityId, data.content_blocks, transaction);
    } else {
        const mediaFields = extractMediaFields(data);
        await syncMediaAttachments(entityType, entityId, mediaFields, transaction);
    }
}

/**
 * Group a list of MediaAttachment instances into { images, videos, pdfs, urls } format.
 * Each value is an array of URL strings, sorted by order_num.
 *
 * @param {Array} attachments - Array of MediaAttachment instances or plain objects
 * @returns {{ images: string[], videos: string[], pdfs: string[], urls: string[] }}
 */
function groupAttachments(attachments) {
    const result = { images: [], videos: [], pdfs: [], urls: [] };
    if (!attachments || !attachments.length) return result;

    const sorted = [...attachments].sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
    for (const att of sorted) {
        if (att.media_type === 'image') result.images.push(att.url);
        else if (att.media_type === 'video') result.videos.push(att.url);
        else if (att.media_type === 'pdf') result.pdfs.push(att.url);
        else if (att.media_type === 'url') result.urls.push(att.url);
    }
    return result;
}

/**
 * Build a media include clause for Sequelize queries.
 * Use this when loading modules/lessons/topics so that media is eager-loaded.
 *
 * @returns Sequelize include object
 */
function mediaInclude() {
    return {
        model: MediaAttachment,
        as: 'attachments',
        attributes: ['id', 'media_type', 'url', 'content', 'order_num'],
        required: false
    };
}

/**
 * Serialize a Module/Lesson/Topic Sequelize instance to JSON with grouped media arrays
 * and the content_blocks array sorted by order_num ASC.
 *
 * @param {Object} item - Sequelize plain object (already toJSON'd)
 * @returns Object with images[], videos[], pdfs[], urls[] and content_blocks[] added
 */
function serializeWithMedia(item) {
    if (!item) return item;
    const { attachments, image_url, video_url, pdf_url, url, content_text, text, ...rest } = item;

    const legacyText = content_text || text || '';

    let grouped;
    let content_blocks = [];

    if (attachments && attachments.length > 0) {
        // Group legacy media arrays (excluding 'text' type)
        const mediaAttachments = attachments.filter(a => a.media_type !== 'text');
        grouped = groupAttachments(mediaAttachments);

        // Map all attachments to content_blocks
        content_blocks = attachments.map(a => {
            const isText = a.media_type === 'text';
            return {
                id: a.id,
                type: a.media_type,
                value: isText ? a.content : a.url,
                order_num: a.order_num
            };
        });

        // Prepend legacy text block at order_num = -1 if legacy text column is populated
        // and no text block exists in attachments
        const hasTextBlock = attachments.some(a => a.media_type === 'text');
        if (legacyText && !hasTextBlock) {
            content_blocks.unshift({
                id: null,
                type: 'text',
                value: legacyText,
                order_num: -1
            });
        }
    } else {
        // Fallback to legacy single-value columns
        grouped = {
            images: image_url ? [image_url] : [],
            videos: video_url ? [video_url] : [],
            pdfs: pdf_url ? [pdf_url] : [],
            urls: url ? [url] : []
        };

        // Construct sequential content_blocks from legacy columns
        let order = 0;
        if (legacyText) {
            content_blocks.push({
                id: null,
                type: 'text',
                value: legacyText,
                order_num: order++
            });
        }
        if (image_url) {
            content_blocks.push({
                id: null,
                type: 'image',
                value: image_url,
                order_num: order++
            });
        }
        if (video_url) {
            content_blocks.push({
                id: null,
                type: 'video',
                value: video_url,
                order_num: order++
            });
        }
        if (pdf_url) {
            content_blocks.push({
                id: null,
                type: 'pdf',
                value: pdf_url,
                order_num: order++
            });
        }
        if (url) {
            content_blocks.push({
                id: null,
                type: 'url',
                value: url,
                order_num: order++
            });
        }
    }

    // Always sort content_blocks by order_num ASC
    content_blocks.sort((a, b) => a.order_num - b.order_num);

    return {
        ...rest,
        content_text: legacyText,
        text: legacyText,
        image_url: image_url || null,
        video_url: video_url || null,
        pdf_url: pdf_url || null,
        url: url || null,
        ...grouped,
        content_blocks
    };
}

/**
 * Extract media fields from request body for use with syncMediaAttachments.
 * Returns only the media-related keys that are present in the body.
 *
 * @param {Object} body - req.body
 * @returns {{ image_url?, video_url?, pdf_url?, url? }}
 */
function extractMediaFields(body) {
    const fields = {};
    if ('image_url' in body) fields.image_url = body.image_url;
    if ('video_url' in body) fields.video_url = body.video_url;
    if ('pdf_url' in body) fields.pdf_url = body.pdf_url;
    if ('url' in body) fields.url = body.url;
    return fields;
}

/**
 * Prepare entity database data from raw payload.
 * Extracts the first of each block type from content_blocks (if provided) and populates
 * legacy single-value columns, ensuring backward compatibility.
 * Removes content_blocks so it doesn't get passed to raw DB writes.
 */
function prepareEntityDbData(data) {
    const dbData = { ...data };
    
    if (data.content_blocks && Array.isArray(data.content_blocks)) {
        const textBlock = data.content_blocks.find(b => b.type === 'text');
        const imageBlock = data.content_blocks.find(b => b.type === 'image');
        const videoBlock = data.content_blocks.find(b => b.type === 'video');
        const pdfBlock = data.content_blocks.find(b => b.type === 'pdf');
        const urlBlock = data.content_blocks.find(b => b.type === 'url');

        dbData.content_text = textBlock ? textBlock.value : null;
        dbData.text = textBlock ? textBlock.value : null;
        dbData.image_url = imageBlock ? imageBlock.value : null;
        dbData.video_url = videoBlock ? videoBlock.value : null;
        dbData.pdf_url = pdfBlock ? pdfBlock.value : null;
        dbData.url = urlBlock ? urlBlock.value : null;
    } else {
        // Strip media array values from direct DB writes
        for (const field of ['image_url', 'video_url', 'pdf_url', 'url']) {
            if (field in dbData) {
                if (Array.isArray(dbData[field])) {
                    dbData[field] = dbData[field][0] || null;
                }
            }
        }
        if (dbData.content_text !== undefined) {
            dbData.text = dbData.content_text;
        } else if (dbData.text !== undefined) {
            dbData.content_text = dbData.text;
        }
    }
    
    delete dbData.content_blocks;
    return dbData;
}

module.exports = {
    syncMediaAttachments,
    syncContentBlocks,
    handleContentSync,
    groupAttachments,
    mediaInclude,
    serializeWithMedia,
    extractMediaFields,
    normalizeMediaField,
    prepareEntityDbData
};
