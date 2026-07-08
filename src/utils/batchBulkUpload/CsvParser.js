const fs = require('fs');
const csvParser = require('csv-parser');

class CsvParser {
    static EXPECTED_HEADERS = ['name', 'course', 'institution', 'instructor', 'start_date', 'end_date', 'enroll_students', 'status'];

    static async parse(filePath, errorBuilder) {
        return new Promise(async (resolve) => {
            const rows = [];
            let rowCount = 0;

            if (filePath.endsWith('.xlsx')) {
                try {
                    const ExcelJS = require('exceljs');
                    const workbook = new ExcelJS.Workbook();
                    await workbook.xlsx.readFile(filePath);
                    const worksheet = workbook.worksheets[0]; // Get first sheet

                    if (!worksheet) {
                        errorBuilder.addFileError('The Excel file is empty.');
                        return resolve([]);
                    }

                    const headers = [];
                    worksheet.getRow(1).eachCell((cell, colNumber) => {
                        headers[colNumber] = cell.value ? cell.value.toString().trim().toLowerCase() : '';
                    });

                    const lowerHeaders = headers.filter(Boolean);
                    const missing = CsvParser.EXPECTED_HEADERS.filter(h => !lowerHeaders.includes(h) && h !== 'enroll_students' && h !== 'enroll_student');
                    if (!lowerHeaders.includes('enroll_students') && !lowerHeaders.includes('enroll_student')) {
                        missing.push('enroll_students');
                    }
                    if (missing.length > 0) {
                        errorBuilder.addFileError(`Missing expected headers: ${missing.join(', ')}`);
                    }

                    worksheet.eachRow((row, rowNumber) => {
                        if (rowNumber === 1) return; // Skip headers
                        
                        const rowData = {};
                        row.eachCell((cell, colNumber) => {
                            if (headers[colNumber]) {
                                rowData[headers[colNumber]] = cell.value ? cell.value.toString() : '';
                            }
                        });

                        rowCount++;
                        if (!rowData.name && Object.keys(rowData).length === 0) return;
                        if (rowData.name && (rowData.name.startsWith('---') || rowData.name.startsWith('NOTE:') || rowData.name.startsWith('INSTRUCTIONS:') || rowData.name.startsWith('[INFO]'))) return;

                        const normalizedRow = {
                            _rowNum: rowCount,
                            name: rowData.name ? rowData.name.trim() : null,
                            course: rowData.course ? rowData.course.trim() : null,
                            institution: rowData.institution ? rowData.institution.trim() : null,
                            instructor: rowData.instructor ? rowData.instructor.trim() : null,
                            start_date: rowData.start_date ? rowData.start_date.trim() : null,
                            end_date: rowData.end_date ? rowData.end_date.trim() : null,
                            enroll_students: rowData.enroll_students ? rowData.enroll_students.trim() : (rowData.enroll_student ? rowData.enroll_student.trim() : null),
                            status: rowData.status ? rowData.status.trim().toLowerCase() : 'active'
                        };
                        rows.push(normalizedRow);
                    });

                    if (rows.length === 0) {
                        errorBuilder.addFileError('The Excel file is empty or contains no valid data rows.');
                    }
                    return resolve(rows);
                } catch (err) {
                    errorBuilder.addFileError(`Failed to parse Excel file: ${err.message}`);
                    return resolve([]);
                }
            }

            // Fallback to CSV parsing
            fs.createReadStream(filePath)
                .pipe(csvParser())
                .on('headers', (headers) => {
                    const lowerHeaders = headers.map(h => h.trim().toLowerCase());
                    const missing = CsvParser.EXPECTED_HEADERS.filter(h => !lowerHeaders.includes(h) && h !== 'enroll_students' && h !== 'enroll_student');
                    if (!lowerHeaders.includes('enroll_students') && !lowerHeaders.includes('enroll_student')) {
                        missing.push('enroll_students');
                    }
                    if (missing.length > 0) {
                        errorBuilder.addFileError(`Missing expected headers: ${missing.join(', ')}`);
                    }
                })
                .on('data', (row) => {
                    rowCount++;
                    if (!row.name && Object.keys(row).length === 0) {
                        return; // Skip completely empty rows
                    }
                    if (row.name && (row.name.startsWith('---') || row.name.startsWith('NOTE:') || row.name.startsWith('INSTRUCTIONS:') || row.name.startsWith('[INFO]'))) {
                        return; // Skip instruction rows
                    }
                    // Normalize fields
                    const normalizedRow = {
                        _rowNum: rowCount,
                        name: row.name ? row.name.trim() : null,
                        course: row.course ? row.course.trim() : null,
                        institution: row.institution ? row.institution.trim() : null,
                        instructor: row.instructor ? row.instructor.trim() : null,
                        start_date: row.start_date ? row.start_date.trim() : null,
                        end_date: row.end_date ? row.end_date.trim() : null,
                        enroll_students: row.enroll_students ? row.enroll_students.trim() : (row.enroll_student ? row.enroll_student.trim() : null),
                        status: row.status ? row.status.trim().toLowerCase() : 'active'
                    };
                    rows.push(normalizedRow);
                })
                .on('end', () => {
                    if (rows.length === 0) {
                        errorBuilder.addFileError('The CSV file is empty or contains no valid data rows.');
                    }
                    resolve(rows);
                })
                .on('error', (err) => {
                    errorBuilder.addFileError(`Failed to parse CSV file: ${err.message}`);
                    resolve([]); // resolve with what we have, errors will be caught
                });
        });
    }
}

module.exports = CsvParser;
