const studentPortalService = require('../services/student-portal.service');

class StudentPortalController {

    // GET /student-portal/profile
    async getProfile(req, res, next) {
        try {
            const profile = await studentPortalService.getProfile(req.user.id);
            res.status(200).json({
                success: true,
                message: 'Student profile retrieved successfully',
                data: profile
            });
        } catch (error) {
            next(error);
        }
    }

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

    // PUT /student-portal/profile
    async updateProfile(req, res, next) {
        try {
            const updateData = { ...req.body };
            
            // If there's a file uploaded, add its URL/path to updateData
            if (req.file) {
                // Assuming static serving of 'uploads' folder
                updateData.profile_image = `/uploads/profiles/${req.file.filename}`;
            }

            const updatedProfile = await studentPortalService.updateProfile(req.user.id, updateData);
            
            res.status(200).json({
                success: true,
                message: 'Profile updated successfully',
                data: updatedProfile
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /student-portal/enrolled-courses?search=&page=1&limit=10
    async getEnrolledCourses(req, res, next) {
        try {
            const { search, page, limit } = req.query;
            const result = await studentPortalService.getEnrolledCourses(req.user.id, { search, page, limit });
            
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
}

module.exports = new StudentPortalController();
