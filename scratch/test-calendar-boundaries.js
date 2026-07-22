const attendanceCalendarService = require('../src/services/institutionRep/attendance-calendar.service');
const { Batch, Enrollment, Student, User } = require('../src/models');

async function test() {
    try {
        // Find a representative user to get the institution ID
        const instRep = await User.findOne({ where: { email: 'kietwomens@gmail.com' } });
        if (!instRep) {
            throw new Error("Institution Rep user kietwomens@gmail.com not found!");
        }
        const institutionId = instRep.institution_id;
        console.log(`Institution ID for kietwomens@gmail.com: ${institutionId}`);

        // Find a batch that belongs to this institution
        const batch = await Batch.findOne({ where: { institution_id: institutionId } });
        if (!batch) {
            throw new Error(`No batch found for institution ${institutionId}`);
        }
        console.log(`Found Batch: ID ${batch.id}, Name "${batch.name}", Start ${batch.start_date}, End ${batch.end_date}`);

        // Find an enrollment for this batch
        const enrollment = await Enrollment.findOne({ where: { batch_id: batch.id } });
        if (!enrollment) {
            throw new Error(`No enrollment found for Batch ${batch.id}`);
        }
        const studentId = enrollment.student_id;
        console.log(`Found Student ID ${studentId} enrolled in Batch ${batch.id}`);

        // Set batch start/end dates to specific testable bounds so we can verify the boundary conditions
        // Let's set start_date = 2026-06-10, end_date = 2026-06-25
        // (This makes it very easy to test mid-month start/end and current month caps)
        const originalStart = batch.start_date;
        const originalEnd = batch.end_date;

        await batch.update({
            start_date: '2026-06-10',
            end_date: '2026-06-25'
        });
        console.log(`\nTemporarily updated batch dates to Start: 2026-06-10, End: 2026-06-25 for testing.`);

        // Test cases:
        // Case 1: Request a month entirely before batch.start_date (e.g. 2026-05)
        // Expected: range_start > range_end, every day 'no_class', all stats 0
        console.log(`\n--- Case 1: Request Month Entirely Before Start (2026-05) ---`);
        const resCase1 = await attendanceCalendarService.getAttendanceCalendar(batch.id, studentId, institutionId, '2026-05');
        console.log(`Month: ${resCase1.month}`);
        console.log(`Total working days: ${resCase1.monthly_stats.total_working_days}`);
        const allNoClassCase1 = resCase1.calendar_days.every(d => d.status === 'no_class');
        console.log(`All days 'no_class'?: ${allNoClassCase1}`);

        // Case 2: Request a month entirely after batch.end_date (e.g. 2026-07)
        // Expected: range_start > range_end, every day 'no_class', all stats 0
        console.log(`\n--- Case 2: Request Month Entirely After End (2026-07) ---`);
        const resCase2 = await attendanceCalendarService.getAttendanceCalendar(batch.id, studentId, institutionId, '2026-07');
        console.log(`Month: ${resCase2.month}`);
        console.log(`Total working days: ${resCase2.monthly_stats.total_working_days}`);
        const allNoClassCase2 = resCase2.calendar_days.every(d => d.status === 'no_class');
        console.log(`All days 'no_class'?: ${allNoClassCase2}`);

        // Case 3: Request the batch's start month, where start_date is mid-month (e.g. June 2026)
        // Batch start is June 10, End is June 25.
        // Today is June 30.
        // Days June 1-9 should be 'no_class'
        // Days June 10-25 should be evaluated (either 'no_class', 'no_session', or present/absent/late if sessions exist)
        // Days June 26-30 should be 'no_class' (since batch ended June 25)
        console.log(`\n--- Case 3: Request Start Month (2026-06) ---`);
        const resCase3 = await attendanceCalendarService.getAttendanceCalendar(batch.id, studentId, institutionId, '2026-06');
        console.log(`Month: ${resCase3.month}`);
        const day1to9 = resCase3.calendar_days.slice(0, 9);
        const day26to30 = resCase3.calendar_days.slice(25);
        console.log(`June 1-9 status:`, day1to9.map(d => `${d.date}: ${d.status}`));
        console.log(`June 26-30 status:`, day26to30.map(d => `${d.date}: ${d.status}`));
        console.log(`June 10-25 sample status:`, resCase3.calendar_days.slice(9, 15).map(d => `${d.date}: ${d.status}`));

        // Case 4: Request the current month for an ongoing batch (Let's make end_date in future e.g. July 25, 2026, and start_date June 10, 2026)
        // Today is 2026-06-30. Let's make end_date '2026-07-15'.
        // Request month: 2026-06.
        // Since end_date is July 15 (future), range_end should be capped at today (June 30) for June.
        // Wait, let's test if we set end_date to a date in July, and request July 2026.
        // range_start for July 2026 will be July 1st.
        // range_end for July 2026 will be today (June 30).
        // Since range_start (July 1st) > range_end (June 30), it should return all 'no_class'.
        // Let's test that specifically:
        await batch.update({
            start_date: '2026-06-10',
            end_date: '2026-07-15'
        });
        console.log(`\nTemporarily updated batch dates to Start: 2026-06-10, End: 2026-07-15 for testing Case 4.`);
        
        console.log(`\n--- Case 4: Request Month in Future (2026-07) but Batch is Ongoing ---`);
        const resCase4 = await attendanceCalendarService.getAttendanceCalendar(batch.id, studentId, institutionId, '2026-07');
        console.log(`Month: ${resCase4.month}`);
        const allNoClassCase4 = resCase4.calendar_days.every(d => d.status === 'no_class');
        console.log(`All days 'no_class'?: ${allNoClassCase4}`);
        console.log(`Total working days: ${resCase4.monthly_stats.total_working_days}`);

        // Restore original batch dates
        await batch.update({
            start_date: originalStart,
            end_date: originalEnd
        });
        console.log(`\nRestored original batch dates.`);

        console.log(`\n--- Case 5: Request a Month Fully within Batch range (e.g. 2026-06 with original dates) ---`);
        const resCase5 = await attendanceCalendarService.getAttendanceCalendar(batch.id, studentId, institutionId, '2026-06');
        console.log(`Month: ${resCase5.month}`);
        console.log(`Total working days: ${resCase5.monthly_stats.total_working_days}`);
        console.log(`Present: ${resCase5.monthly_stats.days_present}`);
        console.log(`Absences: ${resCase5.monthly_stats.absences}`);
        console.log(`Late: ${resCase5.monthly_stats.late_occurrences}`);
        console.log(`Attendance Rate: ${resCase5.monthly_stats.attendance_rate_percent}%`);
        
        // Print weekends/weekdays sample
        console.log(`June 1st (Monday) status: ${resCase5.calendar_days[0].status}`);
        console.log(`June 6th (Saturday) status: ${resCase5.calendar_days[5].status}`);
        console.log(`June 7th (Sunday) status: ${resCase5.calendar_days[6].status}`);

    } catch (e) {
        console.error("Test failed:", e);
    } finally {
        process.exit(0);
    }
}

test();
