const { Batch } = require('../models');

/**
 * Verifies that a batch belongs to an institution and optionally fetches it with associations.
 * Throws a 403 error if the batch doesn't exist or doesn't belong to the institution.
 */
async function verifyBatchOwnership(batchId, institutionId, options = {}) {
    const batch = await Batch.findOne({
        where: { id: batchId, institution_id: institutionId },
        ...options
    });

    if (!batch) {
        const error = new Error('Batch not found or access denied');
        error.statusCode = 403;
        throw error;
    }

    return batch;
}

module.exports = {
    verifyBatchOwnership
};
