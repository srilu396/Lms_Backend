const AssignmentService = require('../services/assignment.service');

const getAssignmentStats = async (req, res) => {
    try {
        const stats = await AssignmentService.getAssignmentStats();
        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const createAssignment = async (req, res) => {
    try {
        const assignment = await AssignmentService.createAssignment(req.body);
        res.status(201).json({ success: true, message: 'Assignment created successfully', data: assignment });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const getAssignmentLookup = async (req, res) => {
    try {
        const result = await AssignmentService.getAssignmentLookup(req.query);
        res.status(200).json({ success: true, message: 'Assignments lookup retrieved successfully', data: result.data });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error retrieving assignments lookup' });
    }
};

const getAllAssignments = async (req, res) => {
    try {
        const assignments = await AssignmentService.getAllAssignments(req.query);
        res.status(200).json({ success: true, ...assignments });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

const getAssignmentById = async (req, res) => {
    try {
        const assignment = await AssignmentService.getAssignmentById(req.params.id);
        res.status(200).json({ success: true, data: assignment });
    } catch (error) {
        res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Server error retrieving assignment' });
    }
};

const updateAssignment = async (req, res) => {
    try {
        const assignment = await AssignmentService.updateAssignment(req.params.id, req.body);
        res.status(200).json({ success: true, message: 'Assignment updated successfully', data: assignment });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const deleteAssignment = async (req, res) => {
    try {
        const result = await AssignmentService.deleteAssignment(req.params.id);
        res.status(200).json({ success: true, ...result });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAssignmentStats,
    createAssignment,
    getAssignmentLookup,
    getAllAssignments,
    getAssignmentById,
    updateAssignment,
    deleteAssignment
};
