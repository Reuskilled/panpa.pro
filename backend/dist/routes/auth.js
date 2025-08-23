"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../database"));
const router = (0, express_1.Router)();
// Register endpoint
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        // Validasyon
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        // Email formatı kontrol et
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        // Şifreyi hash'le
        const saltRounds = 10;
        const passwordHash = await bcryptjs_1.default.hash(password, saltRounds);
        // Kullanıcı zaten var mı kontrol et
        const existingUser = database_1.default.users.findByEmail(email) || database_1.default.users.findByUsername(username);
        if (existingUser) {
            return res.status(400).json({ error: 'Username or email already exists' });
        }
        // Kullanıcıyı oluştur
        const user = database_1.default.users.create({
            username,
            email,
            password_hash: passwordHash
        });
        // JWT token oluştur
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET environment variable is not set');
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, username, email }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({
            message: 'User created successfully',
            token,
            user: { id: user.id, username, email }
        });
    }
    catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Login endpoint
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        // Kullanıcıyı bul
        const user = database_1.default.users.findByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // Şifreyi kontrol et
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        // JWT token oluştur
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET environment variable is not set');
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, username: user.username, email: user.email }, process.env.JWT_SECRET, { expiresIn: '24h' });
        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                avatar_url: user.avatar_url
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
