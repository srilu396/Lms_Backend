const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profile.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = 'uploads/profiles';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

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
router.put('/', upload.single('profile_image'), dynamicValidation, profileController.updateProfile);

module.exports = router;
