class BatchValidator {
    static validateBatchLogic(row, existingBatchNames, errorBuilder) {
        // Validate name
        if (!row.name) {
            errorBuilder.addRowError(row._rowNum, 'Batch Name is required.');
        } else {
            const nameLower = row.name.toLowerCase();
            if (existingBatchNames.has(nameLower)) {
                errorBuilder.addRowError(row._rowNum, `Batch name '${row.name}' already exists in the system or this file.`);
            }
            existingBatchNames.add(nameLower);
        }

        // Validate Dates
        let startDate = null;
        let endDate = null;
        if (row.start_date) {
            startDate = new Date(row.start_date);
            if (isNaN(startDate.getTime())) {
                errorBuilder.addRowError(row._rowNum, 'Invalid start_date format.');
            }
        }
        if (row.end_date) {
            endDate = new Date(row.end_date);
            if (isNaN(endDate.getTime())) {
                errorBuilder.addRowError(row._rowNum, 'Invalid end_date format.');
            }
        }

        if (startDate && endDate && endDate <= startDate) {
            errorBuilder.addRowError(row._rowNum, 'end_date must be after start_date.');
        }

        return { startDate, endDate };
    }
}
module.exports = BatchValidator;
