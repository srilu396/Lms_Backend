class ErrorBuilder {
    constructor() {
        this.fileErrors = [];
        this.rowErrors = new Map();
    }

    addFileError(error) {
        this.fileErrors.push(error);
    }

    addRowError(rowNum, error) {
        if (!this.rowErrors.has(rowNum)) {
            this.rowErrors.set(rowNum, []);
        }
        this.rowErrors.get(rowNum).push(error);
    }

    hasErrors() {
        return this.fileErrors.length > 0 || this.rowErrors.size > 0;
    }

    build() {
        const rows = [];
        for (const [row, errors] of this.rowErrors.entries()) {
            rows.push({ row, errors });
        }
        
        // Sort by row number for clean output
        rows.sort((a, b) => a.row - b.row);

        return {
            file: this.fileErrors,
            rows
        };
    }
}

module.exports = ErrorBuilder;
