const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topic.controller');
const validate = require('../middlewares/validate');
const { createTopicSchema, updateTopicSchema } = require('../utils/validations/course.validation');
const authMiddleware = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');

const adminAndTutor = roleMiddleware('admin', 'tutor');

router.use(authMiddleware);

router.get('/:topicId', adminAndTutor, topicController.getTopic);
router.put('/:topicId', adminAndTutor, validate(updateTopicSchema), topicController.updateTopic);
router.delete('/:topicId', adminAndTutor, topicController.deleteTopic);

module.exports = router;
