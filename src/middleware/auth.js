import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const isPrivateLanHost = (host = '') => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(String(host));

export const isPanelAuthDisabled = (req = {}) => {
    if (String(process.env.PANEL_AUTH_DISABLED || '').toLowerCase() !== 'false') return true;
    const host = String(req.hostname || req.headers?.host || '').split(':')[0];
    const ip = String(req.ip || req.socket?.remoteAddress || '');
    return ['localhost', '127.0.0.1', '::1'].includes(host)
        || isPrivateLanHost(host)
        || ip === '127.0.0.1'
        || ip === '::1'
        || ip === '::ffff:127.0.0.1';
};

export const noPasswordPanelUser = {
    _id: 'local-no-password',
    id: 'local-no-password',
    email: 'sem-senha@local',
    name: 'Atendente',
    role: 'admin',
    isActive: true,
    lastLoginAt: null,
    createdAt: null,
    updatedAt: null
};

export const authMiddleware = async (req, res, next) => {
    try {
        if (isPanelAuthDisabled(req)) {
            req.user = noPasswordPanelUser;
            return next();
        }

        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Get user from token
        const user = await User.findById(decoded.id).select('-password');

        if (!user || !user.isActive) {
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth error:', error.message);
        return res.status(401).json({ error: 'Invalid token' });
    }
};

// Admin only middleware
export const adminOnly = (req, res, next) => {
    if (isPanelAuthDisabled(req)) {
        req.user = req.user || noPasswordPanelUser;
        return next();
    }

    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ error: 'Admin access required' });
    }
};
