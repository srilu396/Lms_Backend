const express = require('express');
const router = express.Router();
const multer = require('multer');
const os = require('os');
const studentController = require('../controllers/student.controller');
const validate = require('../middlewares/validate');
const { createStudentSchema, updateStudentSchema } = require('../utils/validations/student.validation');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

// Only admin can manage students
router.use(authMiddleware);
router.use(roleMiddleware('admin'));

// Setup multer for CSV upload (max 10MB)
const upload = multer({
    dest: os.tmpdir(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Please upload a valid CSV file'));
        }
    }
});

// Statistics endpoints (place these BEFORE /:id to avoid route collision)
router.get('/stats', studentController.getStudentStats);

// Bulk upload template download
router.get('/bulk-upload/template', studentController.downloadBulkUploadTemplate);
// Bulk upload
router.post('/bulk-upload', upload.single('file'), studentController.bulkUpload);

// Core CRUD endpoints
router.post('/', validate(createStudentSchema), studentController.createStudent);
router.get('/', studentController.getStudents);
router.get('/:id', studentController.getStudentById);
router.put('/:id', validate(updateStudentSchema), studentController.updateStudent);
router.delete('/:id', studentController.deleteStudent);

module.exports = router;
