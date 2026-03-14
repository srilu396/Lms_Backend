const express = require('express');
const router = express.Router();
const multer = require('multer');
const os = require('os');
const batchController = require('../controllers/batch.controller');
const validate = require('../middlewares/validate');
const { createBatchSchema, updateBatchSchema } = require('../utils/validations/batch.validation');

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

// Statistics endpoints (place BEFORE /:id to avoid route collision)
router.get('/count', batchController.getTotalCount);
router.get('/active-count', batchController.getActiveCount);
router.get('/average-students', batchController.getAverageStudents);

// Student management inside Batch
router.get('/:id/students', batchController.getBatchStudents);
router.post('/:id/students/bulk-upload', upload.single('file'), batchController.bulkUploadStudentsToBatch);

// Core CRUD endpoints
router.post('/', upload.single('file'), (req, res, next) => {
    // If enroll_students comes as string from form-data, parse it
    if (req.body && typeof req.body.enroll_students === 'string') {
        try {
            req.body.enroll_students = JSON.parse(req.body.enroll_students);
        } catch (e) {
            // Let the validator handle incorrect array formats
        }
    }
    next();
}, validate(createBatchSchema), batchController.createBatch);
router.get('/', batchController.getBatches);
router.get('/:id', batchController.getBatchById);
router.put('/:id', validate(updateBatchSchema), batchController.updateBatch);
router.delete('/:id', batchController.deleteBatch);

module.exports = router;
