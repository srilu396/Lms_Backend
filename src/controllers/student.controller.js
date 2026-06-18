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
            
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({
                    success: false,
                    message: error.errors[0].message || 'A record with this information already exists'
                });
            }

            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error creating student'
            });
        }
    }

    async getStudents(req, res) {
        try {
            const result = await studentService.getStudents(req.query);
            
            let message = 'Students retrieved successfully';
            if (req.query.search && result.data.length === 0) {
                message = 'No students found matching your search criteria.';
            }

            res.status(200).json({
                success: true,
                message: message,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
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

            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({
                    success: false,
                    message: error.errors[0].message || 'A record with this information already exists'
                });
            }

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
                message: 'Student deleted successfully', // As per user request matching the format
                data: null
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error deleting student'
            });
        }
    }

    async getStudentStats(req, res) {
        try {
            const stats = await studentService.getStudentStats();
            res.status(200).json({
                success: true,
                message: 'Student statistics retrieved successfully',
                data: stats
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving statistics'
            });
        }
    }

    async downloadBulkUploadTemplate(req, res) {
        try {
            const csvHeaders = 'first_name,last_name,email,mobile_number,password,status,institution\n';
            const csvSampleData = 'Anilsai,Nunna,saitrinath01c@gmail.com,6300915551,P@55word,inactive,ABC College\nJane,Smith,jane.smith@example.com,9876543210,Password123!,active,\n';
            
            const csvContent = csvHeaders + csvSampleData;

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="student_upload_template.csv"');
            res.status(200).send(csvContent);
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error generating CSV template'
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
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error during bulk upload'
            });
        }
    }
}

module.exports = new StudentController();
