const tutorPortalService = require('../services/tutor-portal.service');

class TutorPortalController {

    // GET /tutor-portal/stats
    // Returns the 4 overview card values for the tutor dashboard
    async getStats(req, res, next) {
        try {
            const stats = await tutorPortalService.getStatsData(req.user);

            res.status(200).json({
                success: true,
                message: 'Tutor stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/dashboard
    // Returns paginated, filterable batch list for the tutor's Batch Management table
    async getDashboard(req, res, next) {
        try {
            const { page, limit, search, status } = req.query;

            const dashboardData = await tutorPortalService.getDashboardData(req.user, {
                page,
                limit,
                search,
                status
            });

            res.status(200).json({
                success: true,
                message: 'Tutor dashboard retrieved successfully',
                data: dashboardData
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/batch/:batchId/course
    // Returns the nested course structure (Modules→Topics→Lessons) for a batch
    async getBatchCourse(req, res, next) {
        try {
            const { batchId } = req.params;
            const courseData = await tutorPortalService.getBatchCourseStructure(
                req.user,
                batchId
            );

            res.status(200).json({
                success: true,
                message: 'Batch course structure retrieved successfully',
                data: courseData
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/batch/:batchId/attendance-stats
    // Returns attendance statistics (Total, Present, Absent, Late)
    async getAttendanceStats(req, res, next) {
        try {
            const { batchId } = req.params;
            const { date } = req.query;

            const stats = await tutorPortalService.getBatchAttendanceStats(
                req.user,
                batchId,
                { date }
            );

            res.status(200).json({
                success: true,
                message: 'Batch attendance stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/batch/:batchId/students
    // Returns paginated student list for attendance tagging
    async getBatchStudents(req, res, next) {
        try {
            const { batchId } = req.params;
            const { date, page, limit, search, status } = req.query;

            const studentData = await tutorPortalService.getBatchStudentsForAttendance(
                req.user,
                batchId,
                { date, page, limit, search, status }
            );

            res.status(200).json({
                success: true,
                message: 'Batch students for attendance retrieved successfully',
                data: studentData
            });
        } catch (error) {
            next(error);
        }
    }

    // POST /tutor-portal/batch/:batchId/attendance
    // Logic to mark or update attendance for students in a batch
    async markAttendance(req, res, next) {
        try {
            const { batchId } = req.params;
            const attendanceData = await tutorPortalService.markBatchAttendance(
                req.user,
                batchId,
                req.body
            );

            res.status(200).json({
                success: true,
                message: 'Attendance marked successfully',
                data: attendanceData
            });
        } catch (error) {
            next(error);
        }
    }

    // --------------------------------------------------
    // QUIZ MODULE
    // --------------------------------------------------

    // GET /tutor-portal/quizzes/stats
    async getQuizStats(req, res, next) {
        try {
            const stats = await tutorPortalService.getQuizStats(req.user);
            res.status(200).json({
                success: true,
                message: 'Global quiz stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/quizzes
    async getQuizzesOverview(req, res, next) {
        try {
            const { page, limit, search } = req.query;
            const data = await tutorPortalService.getQuizzesOverview(req.user, { page, limit, search });
            res.status(200).json({
                success: true,
                message: 'Quizzes overview retrieved successfully',
                data: data.data,
                pagination: data.pagination
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/batch/:batchId/quiz-stats
    async getBatchQuizStats(req, res, next) {
        try {
            const { batchId } = req.params;
            const stats = await tutorPortalService.getBatchQuizStats(req.user, batchId);
            res.status(200).json({
                success: true,
                message: 'Batch quiz stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/batch/:batchId/quizzes
    async getBatchStudentQuizzes(req, res, next) {
        try {
            const { batchId } = req.params;
            const { page, limit, search, status } = req.query;
            const data = await tutorPortalService.getBatchStudentQuizzes(req.user, batchId, { page, limit, search, status });
            res.status(200).json({
                success: true,
                message: 'Batch student quizzes retrieved successfully',
                data: data.data,
                pagination: data.pagination
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/quiz/:quizId/submission/:studentId
    async getQuizReview(req, res, next) {
        try {
            const { quizId, studentId } = req.params;
            const reviewData = await tutorPortalService.getQuizSubmissionReview(
                req.user,
                quizId,
                studentId
            );

            res.status(200).json({
                success: true,
                message: 'Quiz submission review data retrieved successfully',
                data: reviewData
            });
        } catch (error) {
            next(error);
        }
    }

    // --------------------------------------------------
    // ASSIGNMENT MODULE
    // --------------------------------------------------

    // GET /tutor-portal/assignments/stats
    async getAssignmentStats(req, res, next) {
        try {
            const stats = await tutorPortalService.getAssignmentStats(req.user.id);
            res.status(200).json({
                success: true,
                message: 'Global assignment stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/assignments
    async getAssignmentsOverview(req, res, next) {
        try {
            const { page, limit, search } = req.query;
            const data = await tutorPortalService.getAssignmentsOverview(req.user.id, { page, limit, search });
            res.status(200).json({
                success: true,
                message: 'Assignments overview retrieved successfully',
                data: data.data,
                pagination: data.pagination
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/batch/:batchId/assignment-stats
    async getBatchAssignmentStats(req, res, next) {
        try {
            const { batchId } = req.params;
            const stats = await tutorPortalService.getBatchAssignmentStats(req.user.id, batchId);
            res.status(200).json({
                success: true,
                message: 'Batch assignment stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /tutor-portal/batch/:batchId/assignments
    async getBatchStudentAssignments(req, res, next) {
        try {
            const { batchId } = req.params;
            const { page, limit, search, status } = req.query;
            const data = await tutorPortalService.getBatchStudentAssignments(req.user.id, batchId, { page, limit, search, status });
            res.status(200).json({
                success: true,
                message: 'Batch student assignments retrieved successfully',
                data: data.data,
                pagination: data.pagination
            });
        } catch (error) {
            next(error);
        }
    }
}


module.exports = new TutorPortalController();
