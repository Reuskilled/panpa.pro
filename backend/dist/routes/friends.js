"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = __importDefault(require("../database"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Tüm routes auth gerektirir
router.use(auth_1.authMiddleware);
// Arkadaşları getir
router.get('/', (req, res) => {
    try {
        const userId = req.user.id;
        const friends = database_1.default.friends.getFriends(userId);
        res.json({ friends });
    }
    catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ error: 'Failed to get friends' });
    }
});
// Kullanıcı ara
router.get('/search', (req, res) => {
    try {
        const { q } = req.query;
        const userId = req.user.id;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ error: 'Query parameter required' });
        }
        const users = database_1.default.users.searchByUsername(q, userId);
        // Arkadaşlık durumunu ekle
        const usersWithStatus = users.map(user => {
            const isFriend = database_1.default.friends.areFriends(userId, user.id);
            const isBlocked = database_1.default.blockedUsers.isBlocked(userId, user.id);
            const pendingRequest = database_1.default.friendRequests.findPendingRequest(userId, user.id);
            const receivedRequest = database_1.default.friendRequests.findPendingRequest(user.id, userId);
            return {
                id: user.id,
                username: user.username,
                avatar_url: user.avatar_url,
                is_friend: isFriend,
                is_blocked: isBlocked,
                has_pending_request: !!pendingRequest,
                has_received_request: !!receivedRequest
            };
        });
        res.json({ users: usersWithStatus });
    }
    catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ error: 'Failed to search users' });
    }
});
// Arkadaş isteği gönder
router.post('/request', (req, res) => {
    try {
        const { user_id } = req.body;
        const requesterId = req.user.id;
        if (!user_id) {
            return res.status(400).json({ error: 'User ID required' });
        }
        if (user_id === requesterId) {
            return res.status(400).json({ error: 'Cannot send friend request to yourself' });
        }
        // Kullanıcı var mı?
        const targetUser = database_1.default.users.findById(user_id);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Zaten arkadaş mı?
        if (database_1.default.friends.areFriends(requesterId, user_id)) {
            return res.status(400).json({ error: 'Already friends' });
        }
        // Engellemiş mi?
        if (database_1.default.blockedUsers.isBlocked(user_id, requesterId)) {
            return res.status(400).json({ error: 'Cannot send friend request' });
        }
        // Zaten istek var mı?
        const existingRequest = database_1.default.friendRequests.findPendingRequest(requesterId, user_id);
        if (existingRequest) {
            return res.status(400).json({ error: 'Friend request already sent' });
        }
        // Karşı taraftan istek var mı? (otomatik kabul et)
        const receivedRequest = database_1.default.friendRequests.findPendingRequest(user_id, requesterId);
        if (receivedRequest) {
            database_1.default.friendRequests.updateStatus(receivedRequest.id, 'accepted');
            return res.json({ message: 'Friend request accepted', auto_accepted: true });
        }
        // Yeni istek oluştur
        const request = database_1.default.friendRequests.create(requesterId, user_id);
        res.json({ request, message: 'Friend request sent' });
    }
    catch (error) {
        console.error('Send friend request error:', error);
        res.status(500).json({ error: 'Failed to send friend request' });
    }
});
// Arkadaş isteklerini getir
router.get('/requests', (req, res) => {
    try {
        const userId = req.user.id;
        const received = database_1.default.friendRequests.getPendingReceived(userId);
        const sent = database_1.default.friendRequests.getPendingSent(userId);
        res.json({ received, sent });
    }
    catch (error) {
        console.error('Get friend requests error:', error);
        res.status(500).json({ error: 'Failed to get friend requests' });
    }
});
// Arkadaş isteğini kabul et/reddet
router.patch('/requests/:requestId', (req, res) => {
    try {
        const { requestId } = req.params;
        const { action } = req.body; // 'accept' or 'reject'
        const userId = req.user.id;
        if (!['accept', 'reject'].includes(action)) {
            return res.status(400).json({ error: 'Invalid action' });
        }
        // İstek var mı ve bu kullanıcıya mı?
        const request = database_1.default.friendRequests.getPendingReceived(userId)
            .find(r => r.id === requestId);
        if (!request) {
            return res.status(404).json({ error: 'Friend request not found' });
        }
        const status = action === 'accept' ? 'accepted' : 'rejected';
        database_1.default.friendRequests.updateStatus(requestId, status);
        res.json({ message: `Friend request ${status}` });
    }
    catch (error) {
        console.error('Handle friend request error:', error);
        res.status(500).json({ error: 'Failed to handle friend request' });
    }
});
// Arkadaşı kaldır
router.delete('/:friendId', (req, res) => {
    try {
        const { friendId } = req.params;
        const userId = req.user.id;
        if (!database_1.default.friends.areFriends(userId, friendId)) {
            return res.status(400).json({ error: 'Not friends' });
        }
        database_1.default.friends.removeFriend(userId, friendId);
        res.json({ message: 'Friend removed' });
    }
    catch (error) {
        console.error('Remove friend error:', error);
        res.status(500).json({ error: 'Failed to remove friend' });
    }
});
// Kullanıcıyı engelle
router.post('/block', (req, res) => {
    try {
        const { user_id } = req.body;
        const userId = req.user.id;
        if (!user_id) {
            return res.status(400).json({ error: 'User ID required' });
        }
        if (user_id === userId) {
            return res.status(400).json({ error: 'Cannot block yourself' });
        }
        database_1.default.blockedUsers.block(userId, user_id);
        res.json({ message: 'User blocked' });
    }
    catch (error) {
        console.error('Block user error:', error);
        res.status(500).json({ error: 'Failed to block user' });
    }
});
// Kullanıcının engelini kaldır
router.delete('/block/:blockedUserId', (req, res) => {
    try {
        const { blockedUserId } = req.params;
        const userId = req.user.id;
        database_1.default.blockedUsers.unblock(userId, blockedUserId);
        res.json({ message: 'User unblocked' });
    }
    catch (error) {
        console.error('Unblock user error:', error);
        res.status(500).json({ error: 'Failed to unblock user' });
    }
});
// Engellenen kullanıcıları getir
router.get('/blocked', (req, res) => {
    try {
        const userId = req.user.id;
        const blocked = database_1.default.blockedUsers.getBlocked(userId);
        res.json({ blocked });
    }
    catch (error) {
        console.error('Get blocked users error:', error);
        res.status(500).json({ error: 'Failed to get blocked users' });
    }
});
exports.default = router;
