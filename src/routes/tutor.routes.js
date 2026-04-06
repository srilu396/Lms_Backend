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

// Statistics / Summary Endpoints
router.get('/count/total', tutorController.getTotalCount);
router.get('/count/active', tutorController.getActiveCount);
router.get('/count/newly-added', tutorController.getNewlyAddedThisMonth);

// ID-based endpoints
router.get('/:id', tutorController.getTutorById);
router.put('/:id', tutorController.updateTutor);
router.delete('/:id', tutorController.deleteTutor);

module.exports = router;
