const tutorService = require('../services/tutor.service');

class TutorController {
    async createTutor(req, res) {
        try {
            const tutor = await tutorService.createTutor(req.body);
            res.status(201).json({
                success: true,
                message: 'Tutor created successfully',
                data: tutor
            });
        } catch (error) {
            
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({
                    success: false,
                    message: error.errors[0]?.message || 'A record with this information already exists'
                });
            }

            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error creating tutor'
            });
        }
    }

    async getTutors(req, res) {
        try {
            const result = await tutorService.getTutors(req.query);
            
            let message = 'Tutors retrieved successfully';
            if (req.query.search && result.data.length === 0) {
                message = 'No tutors found matching your search criteria.';
            }

            res.status(200).json({
                success: true,
                message: message,
                data: result.data,
                pagination: result.pagination
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving tutors'
            });
        }
    }

    async getTutorById(req, res) {
        try {
            const tutor = await tutorService.getTutorById(req.params.id);
            res.status(200).json({
                success: true,
                message: 'Tutor retrieved successfully',
                data: tutor
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error fetching tutor'
            });
        }
    }

    async updateTutor(req, res) {
        try {
            const tutor = await tutorService.updateTutor(req.params.id, req.body);
            res.status(200).json({
                success: true,
                message: 'Tutor updated successfully',
                data: tutor
            });
        } catch (error) {

            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({
                    success: false,
                    message: error.errors[0]?.message || 'A record with this information already exists'
                });
            }

            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error updating tutor'
            });
        }
    }

    async deleteTutor(req, res) {
        try {
            await tutorService.deleteTutor(req.params.id);
            res.status(200).json({
                success: true,
                message: 'Operation successful',
                data: null
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                success: false,
                message: error.message || 'Server error deleting tutor'
            });
        }
    }

    async getTotalCount(req, res) {
        try {
            const count = await tutorService.getTotalCount();
            res.status(200).json({
                success: true,
                message: 'Total tutors count retrieved',
                data: count
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving count'
            });
        }
    }

    async getActiveCount(req, res) {
        try {
            const count = await tutorService.getActiveCount();
            res.status(200).json({
                success: true,
                message: 'Active tutors count retrieved',
                data: count
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving active count'
            });
        }
    }

    async getNewlyAddedThisMonth(req, res) {
        try {
            const result = await tutorService.getNewlyAddedThisMonth();
            res.status(200).json({
                success: true,
                message: 'Newly added tutors this month retrieved',
                data: result
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Server error retrieving count'
            });
        }
    }
}

module.exports = new TutorController();
