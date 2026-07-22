const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const authMiddleware = require('../middlewares/auth.middleware');
// Dynamic validation middleware
const validate = require('../middlewares/validate');
const { 
    adminUpdateProfileSchema, 
    tutorUpdateProfileSchema, 
    studentUpdateProfileSchema, 
    instRepUpdateProfileSchema 
} = require('../utils/validations/profile.validation');

const dynamicValidation = (req, res, next) => {
    const role = req.user.role;
    let schema;
    
    switch (role) {
        case 'admin':
        case 'user':
            schema = adminUpdateProfileSchema;
            break;
        case 'tutor':
            schema = tutorUpdateProfileSchema;
            break;
        case 'student':
            schema = studentUpdateProfileSchema;
            break;
        case 'institution_representative':
            schema = instRepUpdateProfileSchema;
            break;
        default:
            return res.status(403).json({ success: false, message: 'Invalid role for validation' });
    }
    
    return validate(schema)(req, res, next);
};

// Protect all profile routes with JWT
router.use(authMiddleware);

// GET /profile/basic
// Specifically for the sidebar footer (id, name, email, profile_image)
router.get('/basic', profileController.getBasicProfile);

// GET /profile
router.get('/', profileController.getProfile);

// PUT /profile
router.put('/', dynamicValidation, profileController.updateProfile);

module.exports = router;
