const express = require('express');
const router = express.Router();
const assignmentController = require('../controllers/assignment.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

// Stats route should be before /:id to prevent "stats" being treated as an id
router.get('/stats', assignmentController.getAssignmentStats);
router.get('/lookup', assignmentController.getAssignmentLookup);

// CRUD routes
router.post('/', assignmentController.createAssignment);
router.get('/', assignmentController.getAllAssignments);
router.get('/:id', authMiddleware, roleMiddleware('admin'), assignmentController.getAssignmentById);
router.post('/:id/unlink', authMiddleware, roleMiddleware('admin', 'tutor'), assignmentController.unlinkAssignment);
router.put('/:id', assignmentController.updateAssignment);
router.delete('/:id', assignmentController.deleteAssignment);

module.exports = router;
