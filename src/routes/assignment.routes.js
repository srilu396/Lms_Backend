const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignment.controller');

// Stats route should be before /:id to prevent "stats" being treated as an id
router.get('/stats', assignmentController.getAssignmentStats);

// CRUD routes
router.post('/', assignmentController.createAssignment);
router.get('/', assignmentController.getAllAssignments);
router.get('/:id', assignmentController.getAssignmentById);
router.put('/:id', assignmentController.updateAssignment);
router.delete('/:id', assignmentController.deleteAssignment);

module.exports = router;
