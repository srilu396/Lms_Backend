const fs = require('fs');
const csvParser = require('csv-parser');
const { Student, User, sequelize, Sequelize } = require('../models');
const { Op } = Sequelize;
const models = require('../models');

class StudentService {
    async createStudent(data) {
        if (data.password || data.confirm_password) {
            if (data.password !== data.confirm_password) {
                const error = new Error('Password and confirm password do not match');
                error.statusCode = 400;
                throw error;
            }
        }

        // Validation: Unique Email constraint logic before DB insertion
        const existingStudent = await Student.findOne({ where: { email: data.email } });
        if (existingStudent) {
            const error = new Error('Student already exists with this email address.');
            error.statusCode = 409;
            throw error;
        }

        if (data.institution_id) {
            const institution = await models.Institution.findByPk(data.institution_id);
            if (!institution) {
                const error = new Error('Invalid institution provided.');
                error.statusCode = 400;
                throw error;
            }
            if (!institution.is_active) {
                const error = new Error('The selected institution is inactive.');
                error.statusCode = 400;
                throw error;
            }
        }

        let passwordProvided = true;
        
        if (!data.password) {
            passwordProvided = false;
            // Generate impossible-to-guess placeholder since DB strictly requires a password string
            const crypto = require('crypto');
            data.password = crypto.randomBytes(32).toString('hex');
        }

        data.status = 'active';
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
                role: 'student',
                is_active: true
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
        if (models.Institution) {
            includeOptions.push({
                model: models.Institution,
                as: 'institution',
                required: false,
                attributes: ['id', 'name']
            });
        }
        if (models.Enrollment && models.Batch) {
            includeOptions.push({
                model: models.Enrollment,
                as: 'enrollments',
                required: false,
                include: [{
                    model: models.Batch,
                    required: false,
                    attributes: ['id', 'name']
                }]
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
            if (studentJson.institution) {
                studentJson.institution_id = studentJson.institution.id;
                studentJson.institution_name = studentJson.institution.name;
            }
            if (studentJson.enrollments) {
                studentJson.enrolled_batches = studentJson.enrollments
                    .filter(e => e.Batch || e.batch)
                    .map(e => {
                        const b = e.Batch || e.batch;
                        return { id: b.id, name: b.name };
                    });
                delete studentJson.enrollments;
            } else {
                studentJson.enrolled_batches = [];
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

    async getStudentLookup(query) {
        const { search, limit = 10, institution_id } = query;
        const parsedLimit = Math.min(parseInt(limit, 10) || 10, 50);

        if (!institution_id) {
            const error = new Error('institution_id is required');
            error.statusCode = 400;
            throw error;
        }

        const where = {
            status: 'active',
            institution_id
        };

        if (search) {
            const safeSearch = search.trim().slice(0, 50);
            where[Op.or] = [
                { first_name: { [Op.iLike]: `%${safeSearch}%` } },
                { last_name: { [Op.iLike]: `%${safeSearch}%` } },
                { email: { [Op.iLike]: `%${safeSearch}%` } }
            ];
        }

        const rows = await Student.findAll({
            where,
            limit: parsedLimit,
            attributes: ['id', 'first_name', 'last_name', 'email'],
            order: [['first_name', 'ASC']]
        });

        const formattedRows = rows.map(s => ({
            id: s.id,
            name: `${s.first_name} ${s.last_name || ''}`.trim(),
            email: s.email
        }));

        return {
            data: formattedRows
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
        if (models.Institution) {
            includeOptions.push({
                model: models.Institution,
                as: 'institution',
                required: false,
                attributes: ['id', 'name']
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
        if (studentJson.institution) {
            studentJson.institution_id = studentJson.institution.id;
            studentJson.institution_name = studentJson.institution.name;
        }

        return studentJson;
    }

    async updateStudent(id, updateData) {
        delete updateData.status;

        const student = await Student.findByPk(id);
        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        if (updateData.password || updateData.confirm_password) {
            if (updateData.password !== updateData.confirm_password) {
                const error = new Error('Password and confirm password do not match');
                error.statusCode = 400;
                throw error;
            }
        }

        await student.update(updateData);

        if (updateData.password) {
            const { User } = require('../models');
            const user = await User.findOne({ where: { email: student.email } });
            if (user) {
                await user.update({ password_hash: student.password });
            }
        }

        return await this.getStudentById(id);
    }

    async updateStudentStatus(id, status) {
        const student = await Student.findByPk(id);
        if (!student) {
            const error = new Error('Student not found');
            error.statusCode = 404;
            throw error;
        }

        if (student.status !== status) {
            await student.update({ status });
        }

        // Synchronize associated User account
        const { User } = require('../models');
        const user = await User.findOne({ where: { email: student.email } });
        if (user) {
            const targetActiveState = (status === 'active');
            if (user.is_active !== targetActiveState) {
                await user.update({ is_active: targetActiveState });
            }
        }

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

        const originalEmail = student.email;
        const [localPart, domain] = originalEmail.split('@');
        const deletedSuffix = `+deleted_${Date.now()}`;
        // Keep valid email format to pass Sequelize `isEmail` validation
        const deletedEmail = domain ? `${localPart}${deletedSuffix}@${domain}` : `${originalEmail}${deletedSuffix}`;

        const transaction = await sequelize.transaction();
        try {
            // Modify email to free up the unique constraint
            await student.update({ email: deletedEmail }, { transaction });
            await student.destroy({ transaction });

            // Find and soft-delete the associated User account, modifying its unique fields
            const user = await User.findOne({ where: { email: originalEmail }, transaction });
            if (user) {
                await user.update({ 
                    email: deletedEmail,
                    username: `${user.username}${deletedSuffix}` 
                }, { transaction });
                await user.destroy({ transaction });
            }

            await transaction.commit();
            return true;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async getStudentStats() {
        const statusStats = await Student.findAll({
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count']
            ],
            group: ['status'],
            raw: true
        });

        let total_students = 0;
        let active_students = 0;
        statusStats.forEach(item => {
            const count = parseInt(item.count, 10) || 0;
            total_students += count;
            if (item.status === 'active') {
                active_students = count;
            }
        });

        const studentsGrouped = await Student.findAll({
            attributes: [
                'course_id',
                [sequelize.fn('COUNT', sequelize.col('id')), 'student_count']
            ],
            group: ['course_id'],
            raw: true
        });

        let average_students_per_course = 0;
        if (studentsGrouped.length > 0) {
            let totalStudents = 0;
            let totalCourses = studentsGrouped.length;

            studentsGrouped.forEach(group => {
                totalStudents += parseInt(group.student_count, 10);
            });

            average_students_per_course = Math.round(totalStudents / totalCourses);
        }

        return {
            total_students,
            active_students,
            average_students_per_course
        };
    }

    async bulkUploadStudents(filePath) {
        return new Promise((resolve, reject) => {
            const students = [];
            fs.createReadStream(filePath)
                .pipe(csvParser())
                .on('data', (row) => {
                    // Flexible header resolution
                    const email = row.email || row.Email || row['Email address'] || row['email_address'];
                    const firstName = row.first_name || row['First Name'] || row.first_Name || row.firstName;
                    const lastName = row.last_name || row['Last Name'] || row.last_Name || row.lastName || '';
                    const mobile = row.mobile_number || row['Mobile Number'] || row.phone || row.mobile || null;
                    const rawPassword = row.password || row.Password || row['password_hash'];
                    const courseId = row.course_id || row['Course ID'] || row.courseId;
                    const notes = row.notes || row.Notes || null;
                    const institutionName = row.institution || row.institution_name || row['Institution Name'] || row.Institution || null;

                    if (email && firstName) {
                        const finalPassword = rawPassword && String(rawPassword).trim()
                            ? String(rawPassword).trim()
                            : (email.split('@')[0] + '123!');

                        students.push({
                            first_name: String(firstName).trim(),
                            last_name: String(lastName).trim(),
                            email: String(email).trim(),
                            mobile_number: mobile ? String(mobile).trim() : null,
                            password: finalPassword,
                            course_id: courseId ? parseInt(courseId, 10) : null,
                            notes: notes ? String(notes).trim() : null,
                            institution_name: institutionName ? String(institutionName).trim() : null
                        });
                    }
                })
                .on('end', async () => {
                    try {
                        if (students.length === 0) {
                            const err = new Error('No valid student data found in CSV');
                            err.statusCode = 400;
                            return reject(err);
                        }

                        // 1. Check for duplicate emails within the CSV itself
                        const emailSet = new Set();
                        const internalDuplicates = [];
                        for (const s of students) {
                            if (emailSet.has(s.email)) {
                                internalDuplicates.push(s.email);
                            }
                            emailSet.add(s.email);
                        }

                        if (internalDuplicates.length > 0) {
                            const err = new Error('CSV contains duplicate emails: ' + internalDuplicates.join(', '));
                            err.statusCode = 400;
                            return reject(err);
                        }

                        // 2. Validate course_ids
                        const courseIds = [...new Set(students.filter(s => s.course_id !== null).map(s => s.course_id))];
                        let validCourseIds = new Set();
                        if (courseIds.length > 0) {
                            const validCourses = await models.Course.findAll({
                                where: { id: { [Op.in]: courseIds } },
                                attributes: ['id']
                            });
                            validCourseIds = new Set(validCourses.map(c => c.id));
                        }

                        for (const s of students) {
                            if (s.course_id !== null && !validCourseIds.has(s.course_id)) {
                                const err = new Error(`Invalid course ID provided for student ${s.email}`);
                                err.statusCode = 400;
                                return reject(err);
                            }
                        }

                        // Validate institution names
                        const institutionNames = [...new Set(students.filter(s => s.institution_name !== null).map(s => s.institution_name))];
                        let institutionMap = new Map();
                        if (institutionNames.length > 0) {
                            const validInstitutions = await models.Institution.findAll({
                                where: { name: { [Op.in]: institutionNames } },
                                attributes: ['id', 'name', 'is_active']
                            });
                            
                            validInstitutions.forEach(inst => {
                                institutionMap.set(inst.name, inst);
                            });
                        }

                        for (const s of students) {
                            if (s.institution_name) {
                                const inst = institutionMap.get(s.institution_name);
                                if (!inst) {
                                    const err = new Error(`Invalid institution name provided: ${s.institution_name} for student ${s.email}`);
                                    err.statusCode = 400;
                                    return reject(err);
                                }
                                if (!inst.is_active) {
                                    const err = new Error(`The institution ${s.institution_name} is inactive for student ${s.email}`);
                                    err.statusCode = 400;
                                    return reject(err);
                                }
                                s.institution_id = inst.id;
                            }
                            delete s.institution_name; // Only save the ID, delete temporary name property
                        }

                        // 3. Check for existing emails in the DB to strictly enforce uniqueness
                        const emails = students.map(s => s.email);
                        const existingStudents = await Student.findAll({
                            where: { email: { [Op.in]: emails } },
                            attributes: ['email']
                        });

                        const existingUsers = await User.findAll({
                            where: { email: { [Op.in]: emails } },
                            attributes: ['email']
                        });

                        const dbDuplicates = new Set([
                            ...existingStudents.map(s => s.email),
                            ...existingUsers.map(u => u.email)
                        ]);

                        if (dbDuplicates.size > 0) {
                            const err = new Error('The following academic email addresses already exist in the system: ' + Array.from(dbDuplicates).join(', '));
                            err.statusCode = 409;
                            return reject(err);
                        }

                        // 4. Create Students and Users centrally using a Transaction
                        const transaction = await sequelize.transaction();
                        try {
                            const createdStudents = await Student.bulkCreate(students, { 
                                individualHooks: true, 
                                transaction 
                            });

                            const usersToCreate = createdStudents.map(student => ({
                                full_name: student.first_name + ' ' + (student.last_name || ''),
                                email: student.email,
                                username: student.email.split('@')[0] + Math.floor(Math.random() * 10000),
                                password_hash: student.password, // Handled / hashed by Student hooks 
                                role: 'student',
                                is_active: true
                            }));

                            await User.bulkCreate(usersToCreate, { transaction });

                            await transaction.commit();

                            try {
                                if (fs.existsSync(filePath)) {
                                    fs.unlinkSync(filePath);
                                }
                            } catch (err) {}

                            resolve({
                                success: true, // requested exact response format mapped below
                                processed: students.length,
                                inserted: students.length
                            });
                        } catch (txError) {
                            await transaction.rollback();
                            throw txError;
                        }
                    } catch (error) {
                        try {
                            if (fs.existsSync(filePath)) {
                                fs.unlinkSync(filePath);
                            }
                        } catch (err) {}
                        reject(error);
                    }
                })
                .on('error', (error) => {
                    reject(error);
                });
        });
    }

    async getBulkUploadTemplate() {
        const headers = ['first_name', 'last_name', 'email', 'mobile_number', 'password', 'status', 'institution'];
        const sampleRows = [
            ['John', 'Doe', 'john.doe@example.com', '9876543210', 'Password@123', 'active', 'ABC College'],
            ['Jane', 'Smith', 'jane.smith@example.com', '9123456789', 'Password@456', 'inactive', 'XYZ Institute']
        ];

        const escapeCsvField = (field) => {
            const str = field === null || field === undefined ? '' : String(field);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headerLine = headers.join(',') + '\n';
        const dataLines = sampleRows.map(row => row.map(escapeCsvField).join(',')).join('\n') + '\n';

        return headerLine + dataLines;
    }
}

module.exports = new StudentService();
