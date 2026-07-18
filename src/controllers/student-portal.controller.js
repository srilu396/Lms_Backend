const studentPortalService = require('../services/student-portal.service');
const attendanceReportExport = require('../utils/fileGenerators/attendanceReportExport');

class StudentPortalController {



    // GET /student-portal/stats
    async getStats(req, res, next) {
        try {
            const stats = await studentPortalService.getStats(req.user.id);
            res.status(200).json({
                success: true,
                message: 'Student stats retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/my-batches?page=1&limit=10&search=&status=
    async getMyBatches(req, res, next) {
        try {
            const { page, limit, search, status } = req.query;
            const data = await studentPortalService.getMyBatches(req.user.id, {
                page, limit, search, status
            });
            res.status(200).json({
                success: true,
                message: 'Student batches retrieved successfully',
                data: data.data,
                pagination: {
                    total_items: data.total_items,
                    total_pages: data.total_pages,
                    current_page: data.current_page,
                    items_per_page: data.items_per_page
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/batch/:batchId/course
    async getBatchCourse(req, res, next) {
        try {
            const { batchId } = req.params;
            const courseData = await studentPortalService.getBatchCourseStructure(
                req.user.id,
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

    // GET /student-portal/batch/:batchId/attendance?page=1&limit=10
    async getMyAttendance(req, res, next) {
        try {
            const { batchId } = req.params;
            const { page, limit } = req.query;
            const data = await studentPortalService.getMyAttendance(
                req.user.id,
                batchId,
                { page, limit }
            );
            res.status(200).json({
                success: true,
                message: 'Attendance records retrieved successfully',
                data: data.data,
                summary: data.summary,
                pagination: {
                    total_items: data.total_items,
                    total_pages: data.total_pages,
                    current_page: data.current_page,
                    items_per_page: data.items_per_page
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/my-quizzes?page=1&limit=10
    async getMyQuizzes(req, res, next) {
        try {
            const { page, limit } = req.query;
            const data = await studentPortalService.getMyQuizzes(req.user.id, { page, limit });
            res.status(200).json({
                success: true,
                message: 'Quiz submissions retrieved successfully',
                data: data.data,
                pagination: {
                    total_items: data.total_items,
                    total_pages: data.total_pages,
                    current_page: data.current_page,
                    items_per_page: data.items_per_page
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/my-assignments?page=1&limit=10
    async getMyAssignments(req, res, next) {
        try {
            const { page, limit } = req.query;
            const data = await studentPortalService.getMyAssignments(req.user.id, { page, limit });
            res.status(200).json({
                success: true,
                message: 'Assignment submissions retrieved successfully',
                data: data.data,
                pagination: {
                    total_items: data.total_items,
                    total_pages: data.total_pages,
                    current_page: data.current_page,
                    items_per_page: data.items_per_page
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/quiz/:quizId/review
    async getQuizReview(req, res, next) {
        try {
            const { quizId } = req.params;
            const reviewData = await studentPortalService.getQuizSubmissionReview(
                req.user.id,
                quizId
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


    // GET /student-portal/enrolled-courses?search=&page=1&limit=10&filter=all
    async getEnrolledCourses(req, res, next) {
        try {
            const { search, page, limit, filter } = req.query;
            const result = await studentPortalService.getEnrolledCourses(req.user.id, { search, page, limit, filter });
            
            res.status(200).json({
                success: true,
                message: 'Enrolled courses retrieved successfully',
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/course/:courseId/home
    async getCourseHome(req, res, next) {
        try {
            const { courseId } = req.params;
            const homeData = await studentPortalService.getCourseHome(req.user.id, courseId);
            
            res.status(200).json({
                success: true,
                message: 'Course home retrieved successfully',
                data: homeData
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/course/:courseId/:contentType/activity
    async getCompletedItems(req, res, next) {
        try {
            const { courseId, contentType } = req.params;
            const { page, limit, search, filter } = req.query;
            
            const completionService = require('../services/completion.service');
            const data = await completionService.getCompletedContent(req.user.id, courseId, contentType, { page, limit, search, filter });
            
            res.status(200).json({
                success: true,
                message: `Activity for ${contentType} retrieved successfully`,
                course_name: data.course_name,
                data: data.data,
                pagination: data.pagination
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/course/:courseId/view
    async getCourseView(req, res, next) {
        try {
            const { courseId } = req.params;
            const courseData = await studentPortalService.getCourseView(req.user.id, courseId);
            
            res.status(200).json({
                success: true,
                message: 'Course view data retrieved successfully',
                data: courseData
            });
        } catch (error) {
            next(error);
        }
    }

    // POST /student-portal/lesson/:lessonId/complete
    async completeLesson(req, res, next) {
        try {
            const { lessonId } = req.params;
            const { is_completed, video_watch_pct } = req.body;
            
            const progress = await studentPortalService.completeLesson(req.user.id, lessonId, {
                is_completed,
                video_watch_pct
            });

            res.status(200).json({
                success: true,
                message: 'Lesson marked as completed',
                data: progress
            });
        } catch (error) {
            next(error);
        }
    }

    // POST /student-portal/lesson/:lessonId/read
    async markAsRead(req, res, next) {
        try {
            const { lessonId } = req.params;
            const progress = await studentPortalService.completeLesson(req.user.id, lessonId, {
                is_completed: true,
                video_watch_pct: 100
            });

            res.status(200).json({
                success: true,
                message: 'Lesson marked as read',
                data: progress
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/course/:courseId/sidebar
    async getCourseSidebar(req, res, next) {
        try {
            const { courseId } = req.params;
            const sidebarData = await studentPortalService.getCourseSidebar(req.user.id, courseId);
            res.status(200).json({
                success: true,
                message: 'Course sidebar retrieved successfully',
                data: sidebarData
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/course/:courseId/module/:moduleId
    async getCourseModule(req, res, next) {
        try {
            const { courseId, moduleId } = req.params;
            const moduleData = await studentPortalService.getCourseModule(req.user.id, courseId, moduleId);
            res.status(200).json({
                success: true,
                message: 'Course module retrieved successfully',
                data: moduleData
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/course/:courseId/lesson/:lessonId
    async getCourseLesson(req, res, next) {
        try {
            const { courseId, lessonId } = req.params;
            const lessonData = await studentPortalService.getCourseLesson(req.user.id, courseId, lessonId);
            res.status(200).json({
                success: true,
                message: 'Course lesson retrieved successfully',
                data: lessonData
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/course/:courseId/topic/:topicId
    async getCourseTopic(req, res, next) {
        try {
            const { courseId, topicId } = req.params;
            const topicData = await studentPortalService.getCourseTopic(req.user.id, courseId, topicId);
            res.status(200).json({
                success: true,
                message: 'Course topic retrieved successfully',
                data: topicData
            });
        } catch (error) {
            next(error);
        }
    }



    // POST /student-portal/course/:courseId/complete
    async completeCourse(req, res, next) {
        try {
            const { courseId } = req.params;
            const result = await studentPortalService.completeCourse(req.user.id, courseId);
            res.status(200).json(result);
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/attendance/stats
    async getAttendanceStats(req, res, next) {
        try {
            const stats = await studentPortalService.getAttendanceStats(req.user.id);
            res.status(200).json({
                success: true,
                message: 'Attendance statistics retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/attendance/table
    async getAttendanceTable(req, res, next) {
        try {
            const result = await studentPortalService.getAttendanceTable(req.user.id, req.query);
            res.status(200).json({
                success: true,
                message: 'Attendance table data retrieved successfully',
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/attendance-report
    async getAttendanceReport(req, res, next) {
        try {
            const formatType = req.query.format || 'csv';
            const data = await studentPortalService.getAttendanceReportData(req.user.id);

            if (formatType === 'excel') {
                return await attendanceReportExport.generateExcel(data, res);
            } else if (formatType === 'pdf') {
                return await attendanceReportExport.generatePDF(data, res);
            } else {
                return await attendanceReportExport.generateCSV(data, res);
            }
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/course/:courseId/quiz/:quizId
    async getCourseQuiz(req, res, next) {
        try {
            const { courseId, quizId } = req.params;
            const quizData = await studentPortalService.getCourseQuiz(req.user.id, courseId, quizId);
            res.status(200).json({
                success: true,
                message: 'Quiz data retrieved successfully',
                data: quizData
            });
        } catch (error) {
            next(error);
        }
    }

    // POST /student-portal/course/:courseId/quiz/:quizId/submit
    async submitQuiz(req, res, next) {
        try {
            const { courseId, quizId } = req.params;
            const result = await studentPortalService.submitQuiz(req.user.id, courseId, quizId, req.body);
            res.status(200).json({
                success: true,
                message: 'Quiz submitted successfully',
                submission: result
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/course/quiz/result
    async getQuizResult(req, res, next) {
        try {
            const { courseId, quizId } = req.query;
            const result = await studentPortalService.getQuizResult(req.user.id, courseId, quizId);
            res.status(200).json({
                success: true,
                message: 'Quiz result retrieved successfully',
                data: result
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/course/:courseId/quiz/:quizId/review
    async getCourseQuizReview(req, res, next) {
        try {
            const { courseId, quizId } = req.params;
            const { status } = req.query;
            const reviewData = await studentPortalService.getCourseQuizReview(req.user.id, courseId, quizId, { status });
            res.status(200).json({
                success: true,
                message: 'Quiz review data retrieved successfully',
                data: reviewData
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/assignment/stats
    async getAssignmentStats(req, res, next) {
        try {
            const stats = await studentPortalService.getAssignmentStats(req.user.id);
            res.status(200).json({
                success: true,
                message: 'Assignment statistics retrieved successfully',
                data: stats
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/assignment/table
    async getAssignmentTable(req, res, next) {
        try {
            const result = await studentPortalService.getAssignmentTable(req.user.id, req.query);
            res.status(200).json({
                success: true,
                message: 'Assignment table data retrieved successfully',
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/course/:courseId/assignment/:assignmentId
    async getCourseAssignment(req, res, next) {
        try {
            const { courseId, assignmentId } = req.params;
            const data = await studentPortalService.getCourseAssignment(req.user.id, courseId, assignmentId);
            res.status(200).json(data);
        } catch (error) {
            next(error);
        }
    }

    // POST /student-portal/course/:courseId/assignment/:assignmentId/submit
    async submitCourseAssignment(req, res, next) {
        try {
            const { courseId, assignmentId } = req.params;
            const result = await studentPortalService.submitCourseAssignment(req.user.id, courseId, assignmentId, req.body);
            res.status(200).json({
                success: true,
                message: 'Assignment submitted successfully',
                submission: result
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/course/:courseId/assignment/:assignmentId/result
    async getCourseAssignmentResult(req, res, next) {
        try {
            const { courseId, assignmentId } = req.params;
            const data = await studentPortalService.getCourseAssignmentResult(req.user.id, courseId, assignmentId);
            res.status(200).json(data);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new StudentPortalController();
