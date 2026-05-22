const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware to authenticate Institution Representatives
 * 1. Verifies the JWT token
 * 2. Fetches user details if not already present
 * 3. Validates that the user role is 'institution_representative'
 * 4. Ensures institution_id is attached to req.user
 */
const institutionRepAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Authentication required' });
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ success: false, message: 'Token missing' });
        }

        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'fallback_access_secret');
        
        // Find user and include institution_id
        const user = await User.findByPk(decoded.userId);
        
        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }

        if (user.role !== 'institution_representative') {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied: Requires Institution Representative role' 
            });
        }

        // The user says the column exists in DB, even if I didn't see it in the model file.
        // If user object has it from DB, it's fine. 
        // If not, we might need to check if we should add it to User.js model.
        if (!user.institution_id) {
             return res.status(403).json({ 
                success: false, 
                message: 'User is not associated with any institution' 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token expired' });
        }
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

module.exports = institutionRepAuth;
