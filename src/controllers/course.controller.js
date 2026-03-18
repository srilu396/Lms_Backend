const courseService = require('../services/course.service');

class CourseController {
    async createCourse(req, res) {
        try {
            const course = await courseService.createCourse(req.body);
            res.status(201).json({
                success: true,
                message: 'Course created successfully',
                data: course
            });
        } catch (error) {
            console.error('Error creating course:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error creating course'
            });
        }
    }

    async getCourses(req, res) {
        try {
            const courses = await courseService.getCourses();
            res.status(200).json({
                success: true,
                message: 'Courses retrieved successfully',
                data: courses
            });
        } catch (error) {
            console.error('Error getting courses:', error);
            res.status(500).json({
                success: false,
                message: 'Server error retrieving courses'
            });
        }
    }

    async getCourseById(req, res) {
        try {
            const course = await courseService.getCourseById(req.params.id);
            res.status(200).json({
                success: true,
                message: 'Course retrieved successfully',
                data: course
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error fetching course'
            });
        }
    }

    async updateCourse(req, res) {
        try {
            const course = await courseService.updateCourse(req.params.id, req.body);
            res.status(200).json({
                success: true,
                message: 'Course updated successfully',
                data: course
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error updating course'
            });
        }
    }

    async deleteCourse(req, res) {
        try {
            await courseService.deleteCourse(req.params.id);
            res.status(200).json({
                success: true,
                message: 'Operation successful',
                data: null
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error deleting course'
            });
        }
    }

    async getCurriculum(req, res) {
        try {
            const { student_id, enrollment_id } = req.query;
            const curriculum = await courseService.getCurriculum(req.params.id, student_id, enrollment_id);
            res.status(200).json({
                success: true,
                message: 'Curriculum retrieved successfully',
                data: curriculum
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error fetching curriculum'
            });
        }
    }
}

module.exports = new CourseController();
