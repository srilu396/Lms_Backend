const { 
    Batch, 
    User, 
    Student,
    Enrollment, 
    AttendanceSession, 
    StudentAttendance,
    sequelize
} = require('../../models');
const { Op } = require('sequelize');

class AttendanceCalendarService {
    /**
     * Get attendance calendar and stats for a student in a month
     * @param {number} batchId 
     * @param {number} studentId 
     * @param {number} institutionId 
     * @param {string} monthStr YYYY-MM
     */
    async getAttendanceCalendar(batchId, studentId, institutionId, monthStr) {
        // 1. Verify batch belongs to institution
        const batch = await Batch.findOne({
            where: { id: batchId, institution_id: institutionId }
        });

        if (!batch) {
            const error = new Error('Batch not found or access denied');
            error.statusCode = 403;
            throw error;
        }

        // 2. Verify student exists and belongs to batch
        const student = await Student.findOne({
            where: { id: studentId }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        const enrollment = await Enrollment.findOne({
            where: { batch_id: batchId, student_id: studentId }
        });

        if (!enrollment) {
            const error = new Error('Student not enrolled in this batch');
            error.statusCode = 403;
            throw error;
        }

        // 3. Parse Month
        let year, month;
        if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
            const parts = monthStr.split('-');
            year = parseInt(parts[0]);
            month = parseInt(parts[1]);
        } else {
            const now = new Date();
            year = now.getFullYear();
            month = now.getMonth() + 1;
        }

        // Month is 1-indexed for our logic, Date constructor uses 0-indexed months
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of month
        const formattedMonth = `${year}-${String(month).padStart(2, '0')}`;

        // 4. Fetch Sessions and Attendance
        const sessions = await AttendanceSession.findAll({
            where: {
                batch_id: batchId,
                session_date: {
                    [Op.between]: [
                        this._formatDateToISO(startDate),
                        this._formatDateToISO(endDate)
                    ]
                }
            },
            order: [['session_date', 'ASC']]
        });

        const attendanceRecords = await StudentAttendance.findAll({
            where: {
                enrollment_id: enrollment.id,
                session_id: { [Op.in]: sessions.map(s => s.id) }
            }
        });

        // 5. Generate Calendar Days and Stats
        const calendar_days = [];
        const daysInMonth = endDate.getDate();
        const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

        let stats = {
            total_working_days: 0,
            days_present: 0,
            absences: 0,
            late_occurrences: 0
        };

        for (let d = 1; d <= daysInMonth; d++) {
            const currentDate = new Date(year, month - 1, d);
            const dateStr = this._formatDateToISO(currentDate);
            const dayOfWeek = dayNames[currentDate.getDay()];
            
            // Find sessions for this specific date
            const daySessions = sessions.filter(s => s.session_date === dateStr);
            
            let status = 'no_class';

            if (daySessions.length > 0) {
                // This is a working day
                stats.total_working_days++;
                
                // Get attendance for these sessions
                const records = attendanceRecords.filter(r => 
                    daySessions.some(s => s.id === r.session_id)
                );

                if (records.length > 0) {
                    // Prioritize: present > late > absent
                    if (records.some(r => r.status === 'present')) {
                        status = 'present';
                        stats.days_present++;
                    } else if (records.some(r => r.status === 'late')) {
                        status = 'late';
                        stats.late_occurrences++;
                    } else {
                        status = 'absent';
                        stats.absences++;
                    }
                } else {
                    // Sessions existed but no attendance was marked
                    status = 'absent';
                    stats.absences++;
                }
            } else {
                // No session scheduled
                if (dayOfWeek === 'SAT' || dayOfWeek === 'SUN') {
                    status = 'no_session';
                } else {
                    status = 'no_class';
                }
            }

            calendar_days.push({
                date: dateStr,
                day_of_week: dayOfWeek,
                status: status
            });
        }

        // 6. Calculate Attendance Rate
        const attendance_rate_percent = stats.total_working_days > 0
            ? Math.round((stats.days_present / stats.total_working_days) * 100)
            : 0;

        return {
            student_name: `${student.first_name} ${student.last_name}`,
            student_id: `#STU-${new Date(student.created_at).getFullYear()}-${String(student.id).padStart(3, '0')}`,
            batch_name: batch.name,
            month: formattedMonth,
            calendar_days,
            monthly_stats: {
                total_working_days: stats.total_working_days,
                days_present: stats.days_present,
                absences: stats.absences,
                late_occurrences: stats.late_occurrences,
                attendance_rate_percent: attendance_rate_percent
            }
        };
    }

    /**
     * Helper to format Date object to YYYY-MM-DD
     */
    _formatDateToISO(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}

module.exports = new AttendanceCalendarService();
