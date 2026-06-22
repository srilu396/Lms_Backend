const jwt = require('jsonwebtoken');
const { User } = require('../models');

const optionalAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET || 'fallback_access_secret');
        
        const user = await User.findByPk(decoded.userId);
        if (user) {
            req.user = user;
        }

        next();
    } catch (error) {
        // If token is invalid or expired, just ignore and proceed without req.user
        next();
    }
};

module.exports = optionalAuthMiddleware;
