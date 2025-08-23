"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.database = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const dataDir = './data';
const dbFile = path_1.default.join(dataDir, 'database.json');
// Data klasörü yoksa oluştur
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
// Varsayılan database
const defaultDb = {
    users: [],
    servers: [],
    channels: [],
    messages: [],
    server_members: [],
    friends: [],
    friend_requests: [],
    direct_messages: [],
    blocked_users: [],
    message_reactions: [],
    hidden_conversations: [] // YENİ
};
// Database'i yükle
let db = defaultDb;
if (fs_1.default.existsSync(dbFile)) {
    try {
        const data = fs_1.default.readFileSync(dbFile, 'utf8');
        db = { ...defaultDb, ...JSON.parse(data) };
        console.log('✅ Database loaded from file');
    }
    catch (error) {
        console.error('❌ Error loading database, using default:', error);
        db = defaultDb;
    }
}
else {
    console.log('✅ Created new database');
}
// Database'i kaydet
const saveDb = () => {
    try {
        fs_1.default.writeFileSync(dbFile, JSON.stringify(db, null, 2));
    }
    catch (error) {
        console.error('❌ Error saving database:', error);
    }
};
// Helper fonksiyonlar
exports.database = {
    // Users
    users: {
        findByEmail: (email) => {
            return db.users.find(u => u.email === email);
        },
        findById: (id) => {
            return db.users.find(u => u.id === id);
        },
        findByUsername: (username) => {
            return db.users.find(u => u.username === username);
        },
        searchByUsername: (query, excludeId) => {
            return db.users
                .filter(u => u.id !== excludeId && u.username.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 10);
        },
        create: (userData) => {
            const user = {
                ...userData,
                id: (0, uuid_1.v4)(),
                created_at: new Date().toISOString()
            };
            db.users.push(user);
            saveDb();
            return user;
        }
    },

    // Message Reactions
    messageReactions: {
        getByMessageId: (messageId) => {
            return db.message_reactions.filter(r => r.message_id === messageId);
        },
        add: (messageId, userId, emoji) => {
            const reaction = {
                id: (0, uuid_1.v4)(),
                message_id: messageId,
                user_id: userId,
                emoji,
                created_at: new Date().toISOString()
            };
            db.message_reactions.push(reaction);
            saveDb();
            return reaction;
        },
        remove: (messageId, userId, emoji) => {
            db.message_reactions = db.message_reactions.filter(r => !(r.message_id === messageId && r.user_id === userId && r.emoji === emoji));
            saveDb();
        },
        // Mesaj silme için - belirli mesaj ID'si ile tüm reaction'ları sil
        removeByMessageId: (messageId) => {
            db.message_reactions = db.message_reactions.filter(r => r.message_id !== messageId);
            saveDb();
        },
        getFormattedReactions: (messageId) => {
            const reactions = db.message_reactions.filter(r => r.message_id === messageId);
            const formatted = {};
            reactions.forEach(reaction => {
                if (!formatted[reaction.emoji]) {
                    formatted[reaction.emoji] = { count: 0, users: [] };
                }
                formatted[reaction.emoji].count++;
                formatted[reaction.emoji].users.push(reaction.user_id);
            });
            return formatted;
        }
    },
    // Friends
    friends: {
        getFriends: (userId) => {
            return db.friends
                .filter(f => f.user_id === userId)
                .map(f => {
                const friend = db.users.find(u => u.id === f.friend_id);
                return { ...f, friend: friend };
            })
                .filter(f => f.friend);
        },
        areFriends: (userId1, userId2) => {
            return db.friends.some(f => (f.user_id === userId1 && f.friend_id === userId2) ||
                (f.user_id === userId2 && f.friend_id === userId1));
        },
        addFriend: (userId, friendId) => {
            const friendship1 = {
                id: (0, uuid_1.v4)(),
                user_id: userId,
                friend_id: friendId,
                created_at: new Date().toISOString()
            };
            const friendship2 = {
                id: (0, uuid_1.v4)(),
                user_id: friendId,
                friend_id: userId,
                created_at: new Date().toISOString()
            };
            db.friends.push(friendship1, friendship2);
            saveDb();
        },
        removeFriend: (userId, friendId) => {
            db.friends = db.friends.filter(f => !((f.user_id === userId && f.friend_id === friendId) ||
                (f.user_id === friendId && f.friend_id === userId)));
            saveDb();
        }
    },
    // Friend Requests
    friendRequests: {
        getPendingReceived: (userId) => {
            return db.friend_requests
                .filter(fr => fr.receiver_id === userId && fr.status === 'pending')
                .map(fr => {
                const requester = db.users.find(u => u.id === fr.requester_id);
                return { ...fr, requester: requester };
            })
                .filter(fr => fr.requester);
        },
        getPendingSent: (userId) => {
            return db.friend_requests
                .filter(fr => fr.requester_id === userId && fr.status === 'pending')
                .map(fr => {
                const receiver = db.users.find(u => u.id === fr.receiver_id);
                return { ...fr, receiver: receiver };
            })
                .filter(fr => fr.receiver);
        },
        findPendingRequest: (requesterId, receiverId) => {
            return db.friend_requests.find(fr => fr.requester_id === requesterId &&
                fr.receiver_id === receiverId &&
                fr.status === 'pending');
        },
        create: (requesterId, receiverId) => {
            const request = {
                id: (0, uuid_1.v4)(),
                requester_id: requesterId,
                receiver_id: receiverId,
                status: 'pending',
                created_at: new Date().toISOString()
            };
            db.friend_requests.push(request);
            saveDb();
            return request;
        },
        updateStatus: (requestId, status) => {
            const request = db.friend_requests.find(fr => fr.id === requestId);
            if (request) {
                request.status = status;
                if (status === 'accepted') {
                    // Arkadaş olarak ekle
                    exports.database.friends.addFriend(request.requester_id, request.receiver_id);
                }
                saveDb();
            }
        }
    },
    // Blocked Users
    blockedUsers: {
        isBlocked: (userId, blockedUserId) => {
            return db.blocked_users.some(b => b.user_id === userId && b.blocked_user_id === blockedUserId);
        },
        block: (userId, blockedUserId) => {
            if (!this.isBlocked(userId, blockedUserId)) {
                const block = {
                    id: (0, uuid_1.v4)(),
                    user_id: userId,
                    blocked_user_id: blockedUserId,
                    created_at: new Date().toISOString()
                };
                db.blocked_users.push(block);
                // Arkadaşlığı kaldır
                exports.database.friends.removeFriend(userId, blockedUserId);
                saveDb();
            }
        },
        unblock: (userId, blockedUserId) => {
            db.blocked_users = db.blocked_users.filter(b => !(b.user_id === userId && b.blocked_user_id === blockedUserId));
            saveDb();
        },
        getBlocked: (userId) => {
            return db.blocked_users
                .filter(b => b.user_id === userId)
                .map(b => {
                const blocked_user = db.users.find(u => u.id === b.blocked_user_id);
                return { ...b, blocked_user: blocked_user };
            })
                .filter(b => b.blocked_user);
        }
    },
    // Direct Messages
    directMessages: {
        getConversation: (userId1, userId2, limit = 50) => {
            const messages = db.direct_messages
                .filter(dm => (dm.sender_id === userId1 && dm.receiver_id === userId2) ||
                (dm.sender_id === userId2 && dm.receiver_id === userId1))
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                .slice(-limit);
            return messages.map(dm => {
                const sender = db.users.find(u => u.id === dm.sender_id);
                let reply_to = undefined;
                // Eğer bu mesaj bir yanıtsa, yanıtlanan mesajı bul
                if (dm.reply_to_id) {
                    const originalMessage = db.direct_messages.find(m => m.id === dm.reply_to_id);
                    if (originalMessage) {
                        const originalSender = db.users.find(u => u.id === originalMessage.sender_id);
                        reply_to = {
                            id: originalMessage.id,
                            content: originalMessage.content,
                            sender: originalSender
                        };
                    }
                }
                return { ...dm, sender: sender, reply_to };
            })
                .filter(dm => dm.sender);
        },
        create: (senderId, receiverId, content, replyToId) => {
            const dm = {
                id: (0, uuid_1.v4)(),
                sender_id: senderId,
                receiver_id: receiverId,
                content,
                created_at: new Date().toISOString(),
                reply_to_id: replyToId
            };
            db.direct_messages.push(dm);
            saveDb();
            return dm;
        },
        update: (messageId, newContent) => {
            const messageIndex = db.direct_messages.findIndex(m => m.id === messageId);
            if (messageIndex === -1)
                return null;
            db.direct_messages[messageIndex] = {
                ...db.direct_messages[messageIndex],
                content: newContent,
                updated_at: new Date().toISOString()
            };
            saveDb();
            return db.direct_messages[messageIndex];
        }
    },
    // Servers
    servers: {
        findById: (id) => {
            return db.servers.find(s => s.id === id);
        },
        findByUserId: (userId) => {
            const userServerIds = db.server_members
                .filter(sm => sm.user_id === userId)
                .map(sm => sm.server_id);
            return db.servers
                .filter(s => userServerIds.includes(s.id))
                .map(s => ({
                ...s,
                is_owner: s.owner_id === userId
            }));
        },
        create: (serverData) => {
            const server = {
                ...serverData,
                id: (0, uuid_1.v4)(),
                created_at: new Date().toISOString()
            };
            db.servers.push(server);
            // Owner'ı member olarak ekle
            const membership = {
                id: (0, uuid_1.v4)(),
                server_id: server.id,
                user_id: server.owner_id,
                joined_at: new Date().toISOString()
            };
            db.server_members.push(membership);
            // Varsayılan "general" kanalı oluştur
            const channel = {
                id: (0, uuid_1.v4)(),
                server_id: server.id,
                name: 'general',
                type: 'text',
                position: 0,
                created_at: new Date().toISOString()
            };
            db.channels.push(channel);
            saveDb();
            return server;
        }
    },
    // Server Members
    serverMembers: {
        findByServerAndUser: (serverId, userId) => {
            return db.server_members.find(sm => sm.server_id === serverId && sm.user_id === userId);
        },
        create: (serverId, userId) => {
            const membership = {
                id: (0, uuid_1.v4)(),
                server_id: serverId,
                user_id: userId,
                joined_at: new Date().toISOString()
            };
            db.server_members.push(membership);
            saveDb();
            return membership;
        },
        findByServerId: (serverId) => {
            return db.server_members.filter(sm => sm.server_id === serverId);
        },
        findByUserId: (userId) => {
            return db.server_members.filter(sm => sm.user_id === userId);
        }
    },
    // Channels
    channels: {
        findByServerId: (serverId) => {
            return db.channels
                .filter(c => c.server_id === serverId)
                .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
        },
        findById: (id) => {
            return db.channels.find(c => c.id === id);
        }
    },
    // Messages
    messages: {
        findByChannelId: (channelId, limit = 50) => {
            return db.messages
                .filter(m => m.channel_id === channelId)
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .slice(0, limit)
                .reverse()
                .map(m => {
                const user = db.users.find(u => u.id === m.user_id);
                return {
                    ...m,
                    username: user?.username || 'Unknown'
                };
            });
        },
        create: (messageData) => {
            const message = {
                ...messageData,
                id: (0, uuid_1.v4)(),
                created_at: new Date().toISOString()
            };
            db.messages.push(message);
            saveDb();
            return message;
        }
    }
};
console.log('✅ Database system initialized');
exports.default = exports.database;
