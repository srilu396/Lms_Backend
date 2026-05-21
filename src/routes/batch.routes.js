const express = require('express');
const router = express.Router();
const multer = require('multer');
const os = require('os');
const batchController = require('../controllers/batch.controller');
const validate = require('../middlewares/validate');
const { createBatchSchema, updateBatchSchema } = require('../utils/validations/batch.validation');

// Setup multer for CSV upload
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

// Create a new batch
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

// Bulk upload batches
router.post('/bulk-upload', upload.single('file'), (req, res, next) => {
    // Basic validation could be added here if needed, but the controller handles it
    next();
}, batchController.bulkCreateBatches);

// Get list of batches with pagination and search
router.get('/', batchController.getBatches);

// Get summary statistics
router.get('/stats', batchController.getBatchStats);

// Get a single batch by ID
router.get('/:id', batchController.getBatchById);

// Update a batch completely or partially
router.put('/:id', validate(updateBatchSchema), batchController.updateBatch);

// Delete a batch
router.delete('/:id', batchController.deleteBatch);

// Associate a tutor with a batch
router.post('/:id/tutors', batchController.assignTutor);

// Student management inside Batch
router.get('/:id/students', batchController.getBatchStudents);
router.post('/:id/students/bulk-upload', upload.single('file'), batchController.bulkUploadStudentsToBatch);

// Get batch assignments
router.get('/:id/assignments', batchController.getBatchAssignments);

// Get batch performance
router.get('/:id/performance', batchController.getBatchPerformance);

module.exports = router;
