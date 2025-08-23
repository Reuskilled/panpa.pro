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
// Kullanıcının tüm DM conversation'larını getir (otomatik room join için)
router.get('/conversations', (req, res) => {
    try {
        const userId = req.user.id;
        // Database'deki tüm direct messages'ı al
        const allDMs = database_1.default.directMessages.getConversation(userId, '', 1000);
        // Eğer hiç DM yoksa boş liste döndür
        if (!allDMs || allDMs.length === 0) {
            return res.json({ conversations: [] });
        }
        // Her conversation için en son mesajı bul
        const conversationMap = new Map();
        const currentUser = database_1.default.users.findById(userId);
        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Arkadaş listesindeki kullanıcılarla olan conversation'ları kontrol et
        const friends = database_1.default.friends.getFriends(userId);
        friends.forEach(friend => {
            const otherUserId = friend.friend.id;
            const conversation = database_1.default.directMessages.getConversation(userId, otherUserId, 1);
            if (conversation && conversation.length > 0) {
                const lastMessage = conversation[conversation.length - 1];
                // Son mesaja tepkileri ve yanıt bilgisini ekle
                const lastMessageWithReactions = {
                    ...lastMessage,
                    reactions: database_1.default.messageReactions.getFormattedReactions(lastMessage.id)
                    // reply_to bilgisi zaten getConversation'dan geliyor
                };
                conversationMap.set(otherUserId, {
                    other_user: {
                        id: friend.friend.id,
                        username: friend.friend.username,
                        avatar_url: friend.friend.avatar_url
                    },
                    lastMessage: lastMessageWithReactions,
                    hasUnread: false
                });
            }
        });
        const conversations = Array.from(conversationMap.values()).sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());
        res.json({ conversations });
    }
    catch (error) {
        console.error('Get DM conversations error:', error);
        res.status(500).json({ error: 'Failed to get conversations' });
    }
});
// DM konuşmasını getir
router.get('/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const currentUserId = req.user.id;
        // Kullanıcı var mı?
        const targetUser = database_1.default.users.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Arkadaş mı ya da kendisi mi?
        if (userId !== currentUserId && !database_1.default.friends.areFriends(currentUserId, userId)) {
            return res.status(403).json({ error: 'Can only message friends' });
        }
        // Engellemiş mi?
        if (database_1.default.blockedUsers.isBlocked(userId, currentUserId)) {
            return res.status(403).json({ error: 'Cannot message this user' });
        }
        // Mesajları yanıt bilgileriyle birlikte getir
        const messages = database_1.default.directMessages.getConversation(currentUserId, userId);
        // Her mesaj için tepkileri ekle ve yanıt bilgisini koru
        const messagesWithReactions = messages.map(message => ({
            ...message,
            reactions: database_1.default.messageReactions.getFormattedReactions(message.id),
            // reply_to bilgisi database.directMessages.getConversation'dan geliyor, koruyalım
        }));
        res.json({
            messages: messagesWithReactions,
            user: {
                id: targetUser.id,
                username: targetUser.username,
                avatar_url: targetUser.avatar_url
            }
        });
    }
    catch (error) {
        console.error('Get DM conversation error:', error);
        res.status(500).json({ error: 'Failed to get conversation' });
    }
});
// Reaction ekleme/çıkarma endpoint'i
router.post('/:userId/reactions/:messageId', (req, res) => {
    try {
        const { messageId } = req.params;
        const { emoji } = req.body;
        const userId = req.user.id;
        if (!emoji) {
            return res.status(400).json({ error: 'Emoji required' });
        }
        // Mesaj var mı kontrol et
        const allMessages = database_1.default.directMessages.getConversation(userId, req.params.userId);
        const messageExists = allMessages.some(m => m.id === messageId);
        if (!messageExists) {
            return res.status(404).json({ error: 'Message not found' });
        }
        // Mevcut reaction var mı?
        const existingReactions = database_1.default.messageReactions.getByMessageId(messageId);
        const userReaction = existingReactions.find(r => r.user_id === userId && r.emoji === emoji);
        if (userReaction) {
            // Reaction'ı kaldır
            database_1.default.messageReactions.remove(messageId, userId, emoji);
        }
        else {
            // Reaction ekle
            database_1.default.messageReactions.add(messageId, userId, emoji);
        }
        // Güncel reactions'ları al
        const updatedReactions = database_1.default.messageReactions.getFormattedReactions(messageId);
        res.json({
            reactions: updatedReactions,
            action: userReaction ? 'removed' : 'added'
        });
    }
    catch (error) {
        console.error('Reaction error:', error);
        res.status(500).json({ error: 'Failed to handle reaction' });
    }
});
router.patch('/:userId/messages/:messageId', (req, res) => {
    try {
        const { messageId } = req.params;
        const { content } = req.body;
        const userId = req.user.id;
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Message content required' });
        }
        if (content.length > 2000) {
            return res.status(400).json({ error: 'Message too long' });
        }
        // Mesaj var mı ve kullanıcının mesajı mı kontrol et
        const allMessages = database_1.default.directMessages.getConversation(userId, req.params.userId);
        const message = allMessages.find(m => m.id === messageId && m.sender_id === userId);
        if (!message) {
            return res.status(404).json({ error: 'Message not found or not authorized' });
        }
        // Mesajı güncelle
        const updatedMessage = database_1.default.directMessages.update(messageId, content.trim());
        if (!updatedMessage) {
            return res.status(500).json({ error: 'Failed to update message' });
        }
        // Mesajı tepkileriyle birlikte döndür
        const messageWithReactions = {
            ...updatedMessage,
            reactions: database_1.default.messageReactions.getFormattedReactions(messageId),
            sender: {
                id: req.user.id,
                username: req.user.username
            }
        };
        res.json({
            message: messageWithReactions
        });
    }
    catch (error) {
        console.error('Edit message error:', error);
        res.status(500).json({ error: 'Failed to edit message' });
    }
});
// DM gönder
router.post('/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const { content, reply_to_id } = req.body;
        const senderId = req.user.id;
        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Message content required' });
        }
        if (content.length > 2000) {
            return res.status(400).json({ error: 'Message too long' });
        }
        // Kullanıcı var mı?
        const targetUser = database_1.default.users.findById(userId);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Arkadaş mı?
        if (userId !== senderId && !database_1.default.friends.areFriends(senderId, userId)) {
            return res.status(403).json({ error: 'Can only message friends' });
        }
        // Engellemiş mi?
        if (database_1.default.blockedUsers.isBlocked(userId, senderId)) {
            return res.status(403).json({ error: 'Cannot message this user' });
        }
        // Mesajı oluştur (reply_to_id ile)
        const message = database_1.default.directMessages.create(senderId, userId, content.trim(), reply_to_id);
        // Yanıt bilgisini hazırla
        let reply_to = undefined;
        if (reply_to_id) {
            const allMessages = database_1.default.directMessages.getConversation(senderId, userId);
            const originalMessage = allMessages.find(m => m.id === reply_to_id);
            if (originalMessage) {
                reply_to = originalMessage.reply_to || {
                    id: originalMessage.id,
                    content: originalMessage.content,
                    sender: originalMessage.sender
                };
            }
        }
        const messageWithReactions = {
            ...message,
            reactions: database_1.default.messageReactions.getFormattedReactions(message.id),
            sender: {
                id: req.user.id,
                username: req.user.username
            },
            reply_to: reply_to
        };
        res.json({
            message: messageWithReactions
        });
    }
    catch (error) {
        console.error('Send DM error:', error);
        res.status(500).json({ error: 'Failed to send message' });
    }
});
exports.default = router;
