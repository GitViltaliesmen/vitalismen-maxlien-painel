import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { authMiddleware, adminOnly } from '../middleware/auth.js';

const router = express.Router();

const serializeUser = (user) => ({
    id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password required' });
        }

        // Find user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if active
        if (!user.isActive) {
            return res.status(401).json({ error: 'Account is deactivated' });
        }

        // Generate JWT
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        user.lastLoginAt = new Date();
        await user.save();

        res.json({
            token,
            user: serializeUser(user)
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/register (Initial setup only - create first admin)
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, role = 'operator' } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'All fields required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must have at least 8 characters' });
        }

        // Check if user exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const userCount = await User.countDocuments();
        if (userCount > 0) {
            return res.status(403).json({ error: 'Public registration is disabled' });
        }

        const finalRole = 'admin';

        // Create user
        const user = new User({
            email: email.toLowerCase(),
            password,
            name,
            role: finalRole
        });

        await user.save();

        // Generate JWT
        const token = jwt.sign(
            { id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'User created',
            token,
            user: serializeUser(user)
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/auth/users - Admin lists panel users
router.get('/users', authMiddleware, adminOnly, async (_req, res) => {
    try {
        const users = await User.find({})
            .select('-password')
            .sort({ isActive: -1, role: 1, name: 1 })
            .lean();

        res.json({
            users: users.map((user) => ({
                id: user._id,
                email: user.email,
                name: user.name,
                role: user.role,
                isActive: user.isActive,
                lastLoginAt: user.lastLoginAt || null,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }))
        });
    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/auth/users - Admin creates additional users
router.post('/users', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { email, password, name, role = 'operator' } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'All fields required' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must have at least 8 characters' });
        }

        const allowedRoles = new Set(['admin', 'operator']);
        if (!allowedRoles.has(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const user = new User({
            email: email.toLowerCase(),
            password,
            name,
            role
        });

        await user.save();

        res.status(201).json({
            message: 'User created',
            user: serializeUser(user)
        });
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PATCH /api/auth/users/:id - Admin updates panel users
router.patch('/users/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { name, role, isActive, password } = req.body || {};
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (typeof name === 'string' && name.trim()) {
            user.name = name.trim();
        }

        if (role !== undefined) {
            const allowedRoles = new Set(['admin', 'operator']);
            if (!allowedRoles.has(role)) {
                return res.status(400).json({ error: 'Invalid role' });
            }
            user.role = role;
        }

        if (isActive !== undefined) {
            const nextActive = Boolean(isActive);
            if (!nextActive && String(user._id) === String(req.user._id)) {
                return res.status(400).json({ error: 'You cannot deactivate your own user' });
            }

            user.isActive = nextActive;
        }

        if (typeof password === 'string' && password.trim()) {
            if (password.length < 8) {
                return res.status(400).json({ error: 'Password must have at least 8 characters' });
            }
            user.password = password;
        }

        if (user.role !== 'admin' || !user.isActive) {
            const activeAdminCount = await User.countDocuments({
                _id: { $ne: user._id },
                role: 'admin',
                isActive: true
            });
            if (activeAdminCount < 1) {
                return res.status(400).json({ error: 'At least one active admin is required' });
            }
        }

        await user.save();
        res.json({ message: 'User updated', user: serializeUser(user) });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/auth/me - Get current user
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No token' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.id).select('-password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ user: serializeUser(user) });
    } catch (error) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

export default router;
