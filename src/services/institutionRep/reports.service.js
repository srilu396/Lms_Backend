const { Institution } = require('../../models');

const getRecentReports = async (institutionId, search) => {
    // Fetch the institution to get its name
    const institution = await Institution.findByPk(institutionId);
    if (!institution) {
        throw new Error('Institution not found');
    }

    const institutionName = institution.name;
    const now = new Date();
    // Format: May 20, 2026 • 10:30 AM
    const options = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
    const dateGenerated = new Intl.DateTimeFormat('en-US', options).format(now).replace(', ', ' • ').replace(' AM', ' AM').replace(' PM', ' PM');
    // Note: To match "May 20, 2026 • 10:30 AM" we can do:
    const month = now.toLocaleString('en-US', { month: 'long' });
    const day = now.getDate();
    const year = now.getFullYear();
    const time = now.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const formattedDateGenerated = `${month} ${day}, ${year} • ${time}`;

    const reports = [
        {
            report_type: 'attendance',
            title: `${institutionName} Attendance Summary`,
            category: 'ATTENDANCE',
            description: 'Daily and monthly attendance trends by batch',
            date_generated: formattedDateGenerated
        },
        {
            report_type: 'performance',
            title: `${institutionName} Academic Performance Audit`,
            category: 'PERFORMANCE',
            description: 'Detailed quiz scores and overall GPA distributions',
            date_generated: formattedDateGenerated
        },
        {
            report_type: 'progress',
            title: `${institutionName} Batch Progress Overview`,
            category: 'PROGRESS',
            description: 'Track curriculum coverage and completion milestones',
            date_generated: formattedDateGenerated
        },
        {
            report_type: 'at_risk',
            title: `${institutionName} At-Risk Student Analysis`,
            category: 'CRITICAL',
            description: 'Identify students failing to meet minimum criteria',
            date_generated: formattedDateGenerated
        }
    ];

    if (search) {
        const searchLower = search.toLowerCase();
        return reports.filter(r => r.title.toLowerCase().includes(searchLower));
    }

    return reports;
};

module.exports = {
    getRecentReports
};
