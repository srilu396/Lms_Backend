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
const { verifyBatchOwnership } = require('../../utils/institutionRep.helper');

class AttendanceCalendarService {
    /**
     * Get attendance calendar and stats for a student in a month
     * @param {number} batchId 
     * @param {number} studentId 
     * @param {number} institutionId 
     * @param {string} monthStr YYYY-MM
     */
    async getAttendanceCalendar(batchId, studentId, institutionId, monthStr) {
        // 1. Fetch enrollment including Student and Batch to combine queries
        const enrollment = await Enrollment.findOne({
            where: { batch_id: batchId, student_id: studentId },
            include: [
                {
                    model: Student,
                    as: 'student',
                    attributes: ['id', 'first_name', 'last_name', 'created_at']
                },
                {
                    model: Batch,
                    attributes: ['id', 'name', 'start_date', 'end_date', 'institution_id']
                }
            ]
        });

        // 2. Perform validations with precise error status codes
        if (!enrollment) {
            const studentExists = await Student.count({ where: { id: studentId } });
            if (!studentExists) {
                const error = new Error('Student not found');
                error.statusCode = 404;
                throw error;
            }

            const error = new Error('Student not enrolled in this batch');
            error.statusCode = 403;
            throw error;
        }

        const batch = enrollment.Batch;
        if (!batch || Number(batch.institution_id) !== Number(institutionId)) {
            const error = new Error('Batch not found or access denied');
            error.statusCode = 403;
            throw error;
        }

        const student = enrollment.student;

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

        // Calculate boundary dates using string date comparison
        const batchStartStr = batch.start_date;
        const batchEndStr = batch.end_date;
        const startOfMonthStr = this._formatDateToISO(startDate);
        const endOfMonthStr = this._formatDateToISO(endDate);
        const todayStr = this._formatDateToISO(new Date());

        const range_start = batchStartStr && batchStartStr > startOfMonthStr ? batchStartStr : startOfMonthStr;

        let range_end = endOfMonthStr;
        if (batchEndStr && batchEndStr < range_end) {
            range_end = batchEndStr;
        }
        if (todayStr < range_end) {
            range_end = todayStr;
        }

        if (range_start > range_end) {
            const calendar_days = [];
            const daysInMonth = endDate.getDate();
            const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            for (let d = 1; d <= daysInMonth; d++) {
                const currentDate = new Date(year, month - 1, d);
                const dateStr = this._formatDateToISO(currentDate);
                const dayOfWeek = dayNames[currentDate.getDay()];
                calendar_days.push({
                    date: dateStr,
                    day_of_week: dayOfWeek,
                    status: 'no_class'
                });
            }
            return {
                student_name: `${student.first_name} ${student.last_name}`,
                student_id: `#STU-${new Date(student.created_at).getFullYear()}-${String(student.id).padStart(3, '0')}`,
                batch_name: batch.name,
                month: formattedMonth,
                calendar_days,
                monthly_stats: {
                    total_working_days: 0,
                    days_present: 0,
                    absences: 0,
                    late_occurrences: 0,
                    attendance_rate_percent: 0
                }
            };
        }

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

        // Index sessions and attendance for O(1) lookups
        const sessionsByDate = new Map();
        for (const session of sessions) {
            if (!sessionsByDate.has(session.session_date)) {
                sessionsByDate.set(session.session_date, []);
            }
            sessionsByDate.get(session.session_date).push(session);
        }

        const attendanceBySessionId = new Map();
        for (const record of attendanceRecords) {
            attendanceBySessionId.set(record.session_id, record);
        }

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
            
            let status = 'no_class';

            if (dateStr >= range_start && dateStr <= range_end) {
                const daySessions = sessionsByDate.get(dateStr) || [];
                
                if (daySessions.length > 0) {
                    stats.total_working_days++;
                    
                    const records = [];
                    for (const s of daySessions) {
                        const rec = attendanceBySessionId.get(s.id);
                        if (rec) records.push(rec);
                    }

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
                        status = 'absent';
                        stats.absences++;
                    }
                } else {
                    if (dayOfWeek === 'SAT' || dayOfWeek === 'SUN') {
                        status = 'no_session';
                    } else {
                        status = 'no_class';
                    }
                }
            } else {
                status = 'no_class';
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
