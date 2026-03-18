const topicService = require('../services/topic.service');

class TopicController {
    async addTopic(req, res) {
        try {
            const moduleId = req.params.moduleId || req.body.module_id;
            if (!moduleId) {
                return res.status(400).json({ success: false, message: 'module_id is required' });
            }
            const topic = await topicService.createTopic(moduleId, req.body);
            res.status(201).json({
                success: true,
                message: 'Topic added successfully',
                data: topic
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error adding topic'
            });
        }
    }

    async updateTopic(req, res) {
        try {
            const topic = await topicService.updateTopic(req.params.topicId, req.body);
            res.status(200).json({
                success: true,
                message: 'Topic updated successfully',
                data: topic
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error updating topic'
            });
        }
    }

    async deleteTopic(req, res) {
        try {
            await topicService.deleteTopic(req.params.topicId);
            res.status(200).json({
                success: true,
                message: 'Operation successful',
                data: null
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error deleting topic'
            });
        }
    }
}

module.exports = new TopicController();
