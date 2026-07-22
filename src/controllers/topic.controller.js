const topicService = require('../services/topic.service');

class TopicController {
    async addTopic(req, res) {
        try {
            const lessonId = req.params.lessonId || req.body.lesson_id;
            if (!lessonId) {
                return res.status(400).json({ success: false, message: 'lesson_id is required' });
            }
            const topic = await topicService.createTopic(lessonId, req.body);
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

    async getTopic(req, res) {
        try {
            const topic = await topicService.getTopic(req.params.topicId);
            res.status(200).json({
                success: true,
                message: 'Topic retrieved successfully',
                data: topic
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error retrieving topic'
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
