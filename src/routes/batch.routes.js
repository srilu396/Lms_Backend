const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batch.controller');

// Create a new batch
router.post('/', (req, res) => batchController.createBatch(req, res));

// Get list of batches with pagination and search
router.get('/', (req, res) => batchController.getBatches(req, res));

// Get summary statistics
router.get('/stats', (req, res) => batchController.getBatchStats(req, res));

// Get a single batch by ID
router.get('/:id', (req, res) => batchController.getBatchById(req, res));

// Associate a tutor with a batch
router.post('/:id/tutors', (req, res) => batchController.assignTutor(req, res));

// Get batch assignments
router.get('/:id/assignments', (req, res) => batchController.getBatchAssignments(req, res));

// Get batch performance
router.get('/:id/performance', (req, res) => batchController.getBatchPerformance(req, res));

// Get students in a batch
router.get('/:id/students', (req, res) => batchController.getBatchStudents(req, res));

// Update a batch completely or partially
router.put('/:id', (req, res) => batchController.updateBatch(req, res));

// Delete a batch
router.delete('/:id', (req, res) => batchController.deleteBatch(req, res));

module.exports = router;
