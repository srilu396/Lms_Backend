const fs = require('fs');
const csvParser = require('csv-parser');
const { Student, sequelize, Sequelize } = require('../models');
const { Op } = Sequelize;
const models = require('../models');

class StudentService {
    async createStudent(data) {
        let passwordProvided = true;
        
        if (!data.password) {
            passwordProvided = false;
            // Generate impossible-to-guess placeholder since DB strictly requires a password string
            const crypto = require('crypto');
            data.password = crypto.randomBytes(32).toString('hex');
        }

        // Will trigger beforeCreate hook to hash password
        const student = await Student.create(data);

        const { User, PasswordResetToken } = require('../models');

        // Provision central authenticating user
        const [user, created] = await User.findOrCreate({
            where: { email: student.email },
            defaults: {
                full_name: student.first_name + ' ' + (student.last_name || ''),
                email: student.email,
                username: student.email.split('@')[0] + Math.floor(Math.random() * 10000),
                password_hash: student.password, 
                role: 'student'
            }
        });

        if (!passwordProvided) {
            const crypto = require('crypto');
            const token = crypto.randomBytes(32).toString('hex');
            const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hr validity
            
            await PasswordResetToken.create({
                user_id: user.id,
                token: token,
                expires_at: expires_at,
                is_used: false
            });
            
            const resetLink = `https://your-frontend-domain.com/setup-password?token=${token}`;
            // Log for local dev / simulated email dispatch. NEVER return in API.
            console.log(`[SECURE EMAIL DISPATCH MOCK] -> Student setup link for ${student.email}: ${resetLink}`);
        }
        
        const result = await Student.findByPk(student.id, {
            attributes: { exclude: ['password'] }
        });
        
        return result;
    }

    async getStudents(query) {
        const { search, status, course_id, page = 1, limit = 10 } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);
        const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (parsedPage - 1) * parsedLimit;

        const where = {};

        if (status) {
            where.status = status;
        }

        if (course_id) {
            where.course_id = course_id;
        }

        if (search) {
            const safeSearch = search.trim().slice(0, 50);
            where[Op.or] = [
                { first_name: { [Op.iLike]: `%${safeSearch}%` } },
                { last_name: { [Op.iLike]: `%${safeSearch}%` } },
                { email: { [Op.iLike]: `%${safeSearch}%` } }
            ];
        }

        const includeOptions = [];
        if (models.Course) {
            includeOptions.push({
                model: models.Course,
                as: 'course',
                required: false
            });
        }

        const { count, rows } = await Student.findAndCountAll({
            where,
            include: includeOptions,
            limit: parsedLimit,
            offset: offset,
            attributes: { exclude: ['password'] },
            order: [['created_at', 'DESC']]
        });

        // Format response to include course_name if available
        const formattedRows = rows.map(row => {
            const studentJson = row.toJSON();
            if (studentJson.course) {
                studentJson.course_name = studentJson.course.name || studentJson.course.course_name || null;
                // clean up the nested course object as needed, or leave it
            }
            return studentJson;
        });

        return {
            data: formattedRows,
            pagination: {
                total: count,
                page: parsedPage,
                limit: parsedLimit,
                totalPages: Math.ceil(count / parsedLimit)
            }
        };
    }

    async getStudentById(id) {
        const includeOptions = [];
        if (models.Course) {
            includeOptions.push({
                model: models.Course,
                as: 'course',
                required: false
            });
        }

        const student = await Student.findByPk(id, {
            include: includeOptions,
            attributes: { exclude: ['password'] }
        });

        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        const studentJson = student.toJSON();
        if (studentJson.course) {
            studentJson.course_name = studentJson.course.name || studentJson.course.course_name || null;
        }

        return studentJson;
    }

    async updateStudent(id, updateData) {
        const student = await Student.findByPk(id);
        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        await student.update(updateData);

        return await this.getStudentById(id);
    }

    async deleteStudent(id) {
        const student = await Student.findByPk(id);
        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        if (student.status === 'active') {
            const error = new Error('Active students cannot be deleted. Please set the status to inactive first.');
            error.statusCode = 400;
            throw error;
        }

        await student.destroy();
        return true;
    }

    async getTotalCount() {
        const count = await Student.count();
        return { total_students: count };
    }

    async getActiveCount() {
        const count = await Student.count({
            where: { status: 'active' }
        });
        return { active_students: count };
    }

    async getAveragePerCourse() {
        const studentsGrouped = await Student.findAll({
            attributes: [
                'course_id',
                [sequelize.fn('COUNT', sequelize.col('id')), 'student_count']
            ],
            group: ['course_id'],
            raw: true
        });

        if (studentsGrouped.length === 0) {
            return { average_students_per_course: 0 };
        }

        let totalStudents = 0;
        let totalCourses = studentsGrouped.length;

        studentsGrouped.forEach(group => {
            totalStudents += parseInt(group.student_count, 10);
        });

        const average = Math.round(totalStudents / totalCourses);

        return { average_students_per_course: average };
    }

    async bulkUploadStudents(filePath) {
        return new Promise((resolve, reject) => {
            const students = [];
            fs.createReadStream(filePath)
                .pipe(csvParser())
                .on('data', (row) => {
                    // Minimal validation/mapping 
                    if (row.email && row.first_name && row.last_name && row.password) {
                        students.push({
                            first_name: row.first_name,
                            last_name: row.last_name,
                            email: row.email,
                            mobile_number: row.mobile_number || null,
                            password: row.password,
                            course_id: row.course_id ? parseInt(row.course_id, 10) : null,
                            notes: row.notes || null
                        });
                    }
                })
                .on('end', async () => {
                    try {
                        if (students.length === 0) {
                            return reject(new Error('No valid student data found in CSV'));
                        }

                        // Handle duplicate emails safely
                        const emails = students.map(s => s.email);
                        const existingStudents = await Student.findAll({
                            where: { email: { [Op.in]: emails } },
                            attributes: ['email']
                        });

                        const existingEmails = new Set(existingStudents.map(s => s.email));
                        const uniqueStudentsToInsert = [];
                        const seenEmailsInCsv = new Set();

                        for (const student of students) {
                            if (!existingEmails.has(student.email) && !seenEmailsInCsv.has(student.email)) {
                                uniqueStudentsToInsert.push(student);
                                seenEmailsInCsv.add(student.email);
                            }
                        }

                        if (uniqueStudentsToInsert.length > 0) {
                            // individualHooks: true allows password hashing beforeCreate on bulkCreate
                            await Student.bulkCreate(uniqueStudentsToInsert, { individualHooks: true });
                        }

                        // Remove temp file
                        try {
                            fs.unlinkSync(filePath);
                        } catch (err) {
                            console.error('Error deleting temp file:', err);
                        }

                        resolve({
                            processed: students.length,
                            inserted: uniqueStudentsToInsert.length,
                            duplicates_ignored: students.length - uniqueStudentsToInsert.length
                        });
                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }
}

module.exports = new StudentService();
