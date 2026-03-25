const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');

const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { userId: user.id, role: user.role },
        process.env.JWT_ACCESS_SECRET || 'fallback_access_secret',
        { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
        { userId: user.id },
        process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret',
        { expiresIn: '7d' }
    );
    return { accessToken, refreshToken };
};

class AuthController {
    async login(req, res, next) {
        try {
            const { email, password } = req.body;

            const user = await User.findOne({ where: { email } });
            if (!user) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            const { accessToken, refreshToken } = generateTokens(user);

            // Save refresh token to DB
            user.refresh_token = refreshToken;
            
            // Only toggle is_first_login if there's no password change flow, 
            // but we'll leave it up to the frontend to trigger a password change
            // using the update API to set it to false.
            await user.save();

            // Set refresh token in HTTP-only cookie
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            res.status(200).json({
                success: true,
                accessToken,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    isFirstLogin: user.is_first_login
                }
            });
        } catch (error) {
            next(error);
        }
    }

    async refreshToken(req, res, next) {
        try {
            const token = req.cookies.refreshToken;
            if (!token) {
                return res.status(401).json({ success: false, message: 'Refresh token not found' });
            }

            // Verify the token
            let decoded;
            try {
                decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret');
            } catch (err) {
                // If it's expired, clear cookie to force re-login
                res.clearCookie('refreshToken');
                return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
            }

            const user = await User.findByPk(decoded.userId);
            if (!user || user.refresh_token !== token) {
                res.clearCookie('refreshToken');
                return res.status(401).json({ success: false, message: 'Invalid refresh token mapping or reused token detected' });
            }

            // Refresh token rotation
            const { accessToken, refreshToken: newRefreshToken } = generateTokens(user);
            user.refresh_token = newRefreshToken;
            await user.save();

            res.cookie('refreshToken', newRefreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            res.status(200).json({ success: true, accessToken });
        } catch (error) {
            next(error);
        }
    }

    async logout(req, res) {
        try {
            const token = req.cookies.refreshToken;
            if (token) {
                const decoded = jwt.decode(token);
                if (decoded && decoded.userId) {
                    const user = await User.findByPk(decoded.userId);
                    if (user) {
                        user.refresh_token = null;
                        await user.save();
                    }
                }
                res.clearCookie('refreshToken');
            }
            res.status(200).json({ message: 'Logged out successfully' });
        } catch (error) {
            console.error('Logout error:', error);
            // Even on error, try to clear the cookie
            res.clearCookie('refreshToken');
            res.status(500).json({ success: false, message: 'Server error during logout' });
        }
    }
}

module.exports = new AuthController();
