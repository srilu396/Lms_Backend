const studentService = require('../services/student.service');

class StudentController {
    async createStudent(req, res) {
        try {
            const student = await studentService.createStudent(req.body);
            res.status(201).json({
                success: true,
                message: 'Student created successfully',
                data: student
            });
        } catch (error) {
            console.error('Error creating student:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error creating student'
            });
        }
    }

    async getStudents(req, res) {
        try {
            const result = await studentService.getStudents(req.query);
            res.status(200).json({
                success: true,
                message: 'Students retrieved successfully',
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            console.error('Error getting students:', error);
            res.status(500).json({
                success: false,
                message: 'Server error retrieving students'
            });
        }
    }

    async getStudentById(req, res) {
        try {
            const student = await studentService.getStudentById(req.params.id);
            res.status(200).json({
                success: true,
                message: 'Student retrieved successfully',
                data: student
            });
        } catch (error) {
            console.error('Error fetching student by id:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error fetching student'
            });
        }
    }

    async updateStudent(req, res) {
        try {
            const student = await studentService.updateStudent(req.params.id, req.body);
            res.status(200).json({
                success: true,
                message: 'Student updated successfully',
                data: student
            });
        } catch (error) {
            console.error('Error updating student:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error updating student'
            });
        }
    }

    async deleteStudent(req, res) {
        try {
            await studentService.deleteStudent(req.params.id);
            res.status(200).json({
                success: true,
                message: 'Operation successful', // As per user request matching the format
                data: null
            });
        } catch (error) {
            console.error('Error deleting student:', error);
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error deleting student'
            });
        }
    }

    async getTotalCount(req, res) {
        try {
            const count = await studentService.getTotalCount();
            res.status(200).json({
                success: true,
                message: 'Total students count retrieved',
                data: count
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving count'
            });
        }
    }

    async getActiveCount(req, res) {
        try {
            const count = await studentService.getActiveCount();
            res.status(200).json({
                success: true,
                message: 'Active students count retrieved',
                data: count
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving active count'
            });
        }
    }

    async getAveragePerCourse(req, res) {
        try {
            const averages = await studentService.getAveragePerCourse();
            res.status(200).json({
                success: true,
                message: 'Average students per course retrieved',
                data: averages
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error processing average per course'
            });
        }
    }

    async bulkUpload(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Please upload a valid CSV file'
                });
            }

            const result = await studentService.bulkUploadStudents(req.file.path);
            res.status(201).json({
                success: true,
                message: 'Operation successful',
                data: result
            });
        } catch (error) {
            console.error('Error in bulk upload:', error);
            res.status(500).json({
                success: false,
                message: error.message || 'Server error during bulk upload'
            });
        }
    }
}

module.exports = new StudentController();
