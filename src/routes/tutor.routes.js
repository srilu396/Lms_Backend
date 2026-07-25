const express = require('express');
const router = express.Router();
const tutorController = require('../controllers/tutor.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

// Only admin can manage tutors
router.use(authMiddleware);
router.use(roleMiddleware('admin'));

// Standard CRUD endpoints
router.post('/', tutorController.createTutor);
router.get('/', tutorController.getTutors);
router.get('/lookup', tutorController.getTutorLookup);

// Statistics / Summary Endpoints
router.get('/stats', tutorController.getTutorStats);

// ID-based endpoints
router.get('/:id', tutorController.getTutorById);
router.put('/:id', tutorController.updateTutor);
router.patch('/:id/status', tutorController.updateTutorStatus);
router.delete('/:id', tutorController.deleteTutor);

module.exports = router;
