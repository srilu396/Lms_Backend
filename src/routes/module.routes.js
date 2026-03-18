const express = require('express');
const router = express.Router();
const moduleController = require('../controllers/courseModule.controller');
const topicController = require('../controllers/topic.controller');
const validate = require('../middlewares/validate');
const { createModuleSchema, updateModuleSchema, createTopicSchema } = require('../utils/validations/course.validation');

router.put('/:moduleId', validate(updateModuleSchema), moduleController.updateModule);
router.delete('/:moduleId', moduleController.deleteModule);
router.post('/', validate(createModuleSchema), moduleController.addModule);

router.post('/:moduleId/topics', validate(createTopicSchema), topicController.addTopic);

module.exports = router;
