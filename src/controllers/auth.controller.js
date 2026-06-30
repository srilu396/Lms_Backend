const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../models');

const generateTokens = (user) => {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (process.env.NODE_ENV === 'production' && (!accessSecret || !refreshSecret)) {
        throw new Error('JWT secrets must be set in production environment');
    }

    const accessToken = jwt.sign(
        { userId: user.id, role: user.role, institutionId: user.institution_id },
        process.env.JWT_ACCESS_SECRET || 'fallback_access_secret',
        { expiresIn: '30m' }
    );
    const refreshToken = jwt.sign(
        { userId: user.id },
        refreshSecret || 'fallback_refresh_secret',
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
            // Even on error, try to clear the cookie
            res.clearCookie('refreshToken');
            res.status(500).json({ success: false, message: 'Server error during logout' });
        }
    }

    async forgotPassword(req, res, next) {
        try {
            const { email } = req.body;
            const user = await User.findOne({ where: { email } });
            
            // Return validation error if email does not exist in the database
            if (!user) {
                return res.status(404).json({ success: false, message: 'User with this email does not exist' });
            }

            // Generate secure pseudo-random hex token
            const crypto = require('crypto');
            const token = crypto.randomBytes(32).toString('hex');

            // Expire in 1 hour
            const expires_at = new Date(Date.now() + 60 * 60 * 1000);

            const { PasswordResetToken } = require('../models');

            await PasswordResetToken.create({
                user_id: user.id,
                token,
                expires_at,
                is_used: false
            });

            // TODO: In production, use nodemailer or a service like SendGrid to email the token
            // For now, we console log it and optionally return it so you can test in Postman!
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const resetLink = `${frontendUrl}/reset-password?token=${token}`;

            res.status(200).json({ 
                success: true, 
                message: 'If that email is registered, we have sent a password reset link.',
                // TEMPORARY: Exposing token for your Postman testing flow (only in dev)
                ...(process.env.NODE_ENV !== 'production' && { test_token: token })
            });
        } catch (error) {
            next(error);
        }
    }

    async resetPassword(req, res, next) {
        try {
            const { token, newPassword } = req.body;
            const { PasswordResetToken } = require('../models');

            const resetRecord = await PasswordResetToken.findOne({ 
                where: { token, is_used: false } 
            });

            if (!resetRecord) {
                return res.status(400).json({ success: false, message: 'Invalid or expired password reset token' });
            }

            if (new Date() > resetRecord.expires_at) {
                return res.status(400).json({ success: false, message: 'Password reset token has expired' });
            }

            const user = await User.findByPk(resetRecord.user_id);
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            // Hash new password
            const salt = await bcrypt.genSalt(10);
            user.password_hash = await bcrypt.hash(newPassword, salt);
            
            // Invalidate existing sessions/refresh tokens for security!
            user.refresh_token = null;
            await user.save();

            // Mark token as used
            resetRecord.is_used = true;
            await resetRecord.save();

            res.status(200).json({ success: true, message: 'Password has been successfully restored. Please login with your new password.' });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AuthController();
