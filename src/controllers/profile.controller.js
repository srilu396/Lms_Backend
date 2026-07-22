const studentPortalService = require('../services/student-portal.service');
const tutorPortalService = require('../services/tutor-portal.service');
const institutionRepProfileService = require('../services/institutionRep/profile.service');
const userService = require('../services/user.service');
const { Tutor, Student, Institution, Batch, Enrollment, StudentAttendance } = require('../models');

const services = {
    student: studentPortalService,
    tutor: tutorPortalService,
    institution_representative: institutionRepProfileService,
    admin: userService,
    user: userService
};

const formatProfileImage = (req, imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith('http')) return imagePath;
    
    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}${imagePath.startsWith('/') ? '' : '/'}${imagePath}`;
};



class ProfileController {
    
    // GET /profile/basic
    async getBasicProfile(req, res, next) {
        try {
            res.status(200).json({
                success: true,
                data: {
                    id: req.user.id,
                    name: req.user.full_name,
                    email: req.user.email,
                    profile_image: formatProfileImage(req, req.user.avatar_url)
                }
            });
        } catch (error) {
            next(error);
        }
    }

    // GET /profile
    async getProfile(req, res, next) {
        try {
            const role = req.user.role;
            const service = services[role];

            if (!service) {
                return res.status(403).json({ success: false, message: 'Profile access not configured for this role.' });
            }

            // Standardize base response data
            const baseData = {
                id: req.user.id,
                name: req.user.full_name,
                email: req.user.email,
                role: req.user.role,
                phone_number: req.user.phone_number,
                profile_image: formatProfileImage(req, req.user.avatar_url),
                created_date: req.user.created_at,
                status: req.user.is_active ? 'active' : 'inactive'
            };

            let responseData = { ...baseData };

            if (role === 'tutor') {
                const tutor = await Tutor.findOne({
                    where: { email: req.user.email },
                    include: [{
                        model: Batch,
                        as: 'batches',
                        attributes: ['id', 'name', 'start_date', 'end_date'],
                        through: { attributes: [] }
                    }]
                });
                const allocated_batches = tutor ? (tutor.batches || []) : [];
                responseData.allocated_batches = allocated_batches;
                responseData.allocated_batches_count = allocated_batches.length;
                if (tutor && tutor.profile_image && !responseData.profile_image) {
                    responseData.profile_image = formatProfileImage(req, tutor.profile_image);
                }
            } 
            else if (role === 'student') {
                const student = await Student.findOne({ 
                    where: { email: req.user.email },
                    include: [
                        { model: Institution, as: 'institution', attributes: ['id', 'name'] },
                        { 
                            model: Enrollment, 
                            as: 'enrollments',
                            where: { status: 'active' }, 
                            required: false,
                            include: [{ model: Batch, attributes: ['id', 'name', 'start_date', 'end_date'] }]
                        }
                    ]
                });

                let allocated_batches = [];
                let attendance_stats = null;
                let phone_number = req.user.phone_number;

                if (student) {
                    phone_number = student.phone_number || phone_number;
                    allocated_batches = (student.enrollments || []).map(e => e.Batch).filter(Boolean);
                    
                    const total_sessions = await StudentAttendance.count({ where: { student_id: student.id } });
                    const present_sessions = await StudentAttendance.count({ where: { student_id: student.id, status: 'present' } });
                    attendance_stats = {
                        total: total_sessions,
                        present: present_sessions,
                        percentage: total_sessions > 0 ? ((present_sessions / total_sessions) * 100).toFixed(2) + '%' : '0%'
                    };
                }

                responseData.allocated_batches = allocated_batches;
                responseData.allocated_batches_count = allocated_batches.length;
                responseData.institution_details = student ? student.Institution : null;
                responseData.attendance = attendance_stats;
                responseData.phone_number = phone_number;
            } 
            else if (role === 'institution_representative') {
                let allocated_batches = [];
                if (req.user.institution_id) {
                    allocated_batches = await Batch.findAll({ 
                        where: { institution_id: req.user.institution_id },
                        attributes: ['id', 'name', 'start_date', 'end_date']
                    });
                }
                responseData.allocated_batches = allocated_batches;
                responseData.allocated_batches_count = allocated_batches.length;
            }

            res.status(200).json({
                success: true,
                message: `${role.charAt(0).toUpperCase() + role.slice(1)} profile retrieved successfully`,
                data: responseData
            });
        } catch (error) {
            next(error);
        }
    }

    // PUT /profile
    async updateProfile(req, res, next) {
        try {
            const role = req.user.role;
            const service = services[role];

            if (!service || !service.updateProfile) {
                if (role === 'admin' || role === 'user') {
                    // Allowed
                } else {
                    return res.status(403).json({ success: false, message: 'Profile update not configured for this role.' });
                }
            }

            const updateData = { ...req.body };
            
            // Normalize name field to full_name for underlying services
            if (updateData.name && !updateData.full_name) {
                updateData.full_name = updateData.name;
                delete updateData.name;
            }
            if (updateData.status) {
                updateData.is_active = (updateData.status === 'active');
                delete updateData.status;
            }
            // The frontend uploads directly and sends the URL
            const incomingImage = updateData.profile_image || updateData.avatar_url;
            if (incomingImage) {
                updateData.profile_image = incomingImage;
                updateData.avatar_url = incomingImage;
                
                // Force sync avatar_url on the User model regardless of underlying service logic
                await req.user.update({ avatar_url: incomingImage });
            }

            let updatedProfile;
            
            if (role === 'admin' || role === 'user') {
                updatedProfile = await service.updateUser(req.user.id, updateData);
            } else if (role === 'tutor') {
                const tutor = await Tutor.findOne({ where: { email: req.user.email } });
                if (!tutor) {
                    return res.status(403).json({ success: false, message: 'Tutor profile not found for this user.' });
                }
                updatedProfile = await service.updateProfile(tutor.id, req.user.id, updateData);
            } else if (role === 'institution_representative') {
                updatedProfile = await service.updateProfile(req.user.id, updateData);
            } else if (role === 'student') {
                updatedProfile = await service.updateProfile(req.user.id, updateData);
            }

            if (updatedProfile && updatedProfile.avatar_url !== undefined) {
                updatedProfile.profile_image = formatProfileImage(req, updatedProfile.avatar_url);
                delete updatedProfile.avatar_url;
            } else if (updatedProfile && updatedProfile.profile_image) {
                updatedProfile.profile_image = formatProfileImage(req, updatedProfile.profile_image);
            }

            res.status(200).json({
                success: true,
                message: 'Profile updated successfully',
                data: updatedProfile
            });
        } catch (error) {
            if (error.statusCode) {
                const response = { success: false, message: error.message };
                if (error.errors) response.errors = error.errors;
                return res.status(error.statusCode).json(response);
            }
            next(error);
        }
    }
}

module.exports = new ProfileController();
