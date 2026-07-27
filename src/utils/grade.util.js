/**
 * Generates a standard grade based on the percentage score.
 * 
 * Grading Scale:
 * 90–100 = A+
 * 80–89 = A
 * 70–79 = B+
 * 60–69 = B
 * 50–59 = C
 * 40–49 = D
 * Below 40 = F
 * 
 * @param {number} percentage - The percentage score (0-100)
 * @returns {string} The computed grade
 */
function generateGrade(percentage) {
    if (percentage >= 90) return 'A+';
    if (percentage >= 80) return 'A';
    if (percentage >= 70) return 'B+';
    if (percentage >= 60) return 'B';
    if (percentage >= 50) return 'C';
    if (percentage >= 40) return 'D';
    return 'F';
}

module.exports = {
    generateGrade
};
