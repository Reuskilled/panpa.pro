"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = __importDefault(require("../database"));
const authMiddleware = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid token' });
        }
        const token = authHeader.substring(7); // "Bearer " kısmını çıkar
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET environment variable is not set');
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Kullanıcının hala var olduğunu kontrol et
        const user = database_1.default.users.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        req.user = { id: user.id, username: user.username, email: user.email };
        next();
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
};
exports.authMiddleware = authMiddleware;
