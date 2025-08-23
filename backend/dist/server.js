"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
// Database'i import et - BU SATIR EKSİKTİ
const database_1 = __importDefault(require("./database"));
// Routes
const auth_1 = __importDefault(require("./routes/auth"));
const servers_1 = __importDefault(require("./routes/servers"));
const friends_1 = __importDefault(require("./routes/friends"));
const dm_1 = __importDefault(require("./routes/dm"));
// Middleware
const auth_2 = require("./middleware/auth");
const PORT = Number(process.env.PORT) || 3001;
const ORIGIN = process.env.ORIGIN || 'http://localhost:3000';
const app = (0, express_1.default)();
// Middleware
app.use((0, cors_1.default)({
    origin: ORIGIN,
    credentials: true
}));
app.use(express_1.default.json());
// Health check
app.get('/health', (_req, res) => {
    res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        message: 'Discord Clone Backend is running!'
    });
});
// Routes
app.use('/auth', auth_1.default);
app.use('/servers', servers_1.default);
app.use('/friends', friends_1.default);
app.use('/dm', dm_1.default);
// HTTP server oluştur
const httpServer = http_1.default.createServer(app);
// Socket.IO setup
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: ORIGIN,
        methods: ["GET", "POST"]
    }
});
exports.io = io;
// Connected users tracking
const connectedUsers = new Map(); // userId -> socketId mapping
// Socket.IO authentication middleware
io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
        return next(new Error('Authentication error: Missing token'));
    }
    // Express auth middleware'ini re-use et
    const req = {
        headers: { authorization: `Bearer ${token}` }
    };
    const res = {
        status: () => ({ json: () => { } })
    };
    (0, auth_2.authMiddleware)(req, res, (err) => {
        if (err) {
            return next(new Error('Authentication error: Invalid token'));
        }
        // Socket'a user bilgisini ekle
        socket.user = req.user;
        next();
    });
});
// Socket.IO connection handling
io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`🔌 User ${user.username} connected (${socket.id})`);
    // User'ı connected users'a ekle
    connectedUsers.set(user.id, socket.id);
    // Client'a connection başarılı mesajı
    socket.emit('connected', {
        socketId: socket.id,
        user: { id: user.id, username: user.username }
    });
    // Kullanıcı disconnect olduğunda
    socket.on('disconnect', (reason) => {
        console.log(`🔌 User ${user.username} disconnected: ${reason}`);
        connectedUsers.delete(user.id);
    });
    // Server'a katılma (socket rooms)
    socket.on('join_server', (serverId) => {
        socket.join(`server_${serverId}`);
        console.log(`📡 ${user.username} joined server ${serverId}`);
    });
    // Server'dan ayrılma
    socket.on('leave_server', (serverId) => {
        socket.leave(`server_${serverId}`);
        console.log(`📡 ${user.username} left server ${serverId}`);
    });
    // DM room'una katılma
    socket.on('join_dm', (otherUserId) => {
        const roomName = [user.id, otherUserId].sort().join('_');
        socket.join(`dm_${roomName}`);
        console.log(`💬 ${user.username} joined DM with ${otherUserId}`);
    });
    // Server mesajı gönderme
    socket.on('send_message', (data) => {
        const { channelId, content } = data;
        console.log(`💬 Message from ${user.username} in channel ${channelId}: ${content}`);
        // Aynı sunucudaki herkese mesajı gönder
        socket.broadcast.emit('new_message', {
            id: Date.now(),
            channel_id: channelId,
            user_id: user.id,
            username: user.username,
            content,
            created_at: new Date().toISOString()
        });
    });
    // DM mesajı gönderme - DÜZELTILMIŞ VERSİYON
    socket.on('send_dm', (data) => {
        const { receiverId, content, replyToId } = data;
        const roomName = [user.id, receiverId].sort().join('_');
        console.log(`💬 DM from ${user.username} to ${receiverId}: ${content}`, replyToId ? `(replying to: ${replyToId})` : '');
        // Eğer yanıt mesajıysa, orijinal mesajı bul
        let reply_to = undefined;
        if (replyToId) {
            const allMessages = database_1.default.directMessages.getConversation(user.id, receiverId);
            const originalMessage = allMessages.find(m => m.id === replyToId);
            if (originalMessage && originalMessage.reply_to) {
                reply_to = originalMessage.reply_to;
            }
            else if (originalMessage) {
                reply_to = {
                    id: originalMessage.id,
                    content: originalMessage.content,
                    sender: originalMessage.sender
                };
            }
        }
        const messageData = {
            id: Date.now(),
            sender_id: user.id,
            receiver_id: receiverId,
            content,
            created_at: new Date().toISOString(),
            reply_to_id: replyToId,
            reply_to: reply_to, // Yanıt bilgisini ekle
            sender: {
                id: user.id,
                username: user.username
            }
        };
        // DM room'undaki herkese gönder
        socket.to(`dm_${roomName}`).emit('new_dm', messageData);
        // Eğer alıcı online ise direkt socket'ine gönder
        const receiverSocketId = connectedUsers.get(receiverId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('new_dm', messageData);
            console.log(`✅ DM sent to ${receiverId} via socket ${receiverSocketId}`);
        }
        else {
            console.log(`❌ User ${receiverId} is offline`);
        }
    });
    // Tepki güncellemeleri
    socket.on('reaction_update', (data) => {
        console.log(`🎭 Reaction update from ${user.username}:`, data);
        // Karşı taraf online ise tepki güncellemesini gönder
        const receiverSocketId = connectedUsers.get(data.conversationId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('reaction_update', {
                messageId: data.messageId,
                emoji: data.emoji,
                userId: data.userId,
                username: data.username,
                action: data.action,
                reactions: data.reactions,
                conversationId: user.id
            });
            console.log(`✅ Reaction sent to ${data.conversationId} via socket ${receiverSocketId}`);
        }
        else {
            console.log(`❌ User ${data.conversationId} is offline`);
        }
    });
    // Mesaj düzenleme
    socket.on('message_edit', (data) => {
        console.log(`✏️ Message edit from ${user.username}:`, data);
        // Karşı taraf online ise direkt gönder
        const receiverSocketId = connectedUsers.get(data.conversationId);
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('message_edit', {
                messageId: data.messageId,
                content: data.content,
                userId: data.userId,
                username: data.username,
                conversationId: user.id,
                updated_at: data.updated_at
            });
            console.log(`✅ Message edit sent to ${data.conversationId} via socket ${receiverSocketId}`);
        }
        else {
            console.log(`❌ User ${data.conversationId} is offline`);
        }
    });
    // Typing indicator
    socket.on('typing_start', (data) => {
        const { channelId, receiverId } = data;
        if (channelId) {
            socket.broadcast.emit('user_typing', {
                channelId,
                userId: user.id,
                username: user.username
            });
        }
        else if (receiverId) {
            const roomName = [user.id, receiverId].sort().join('_');
            socket.to(`dm_${roomName}`).emit('user_typing', {
                userId: user.id,
                username: user.username
            });
        }
    });
    socket.on('typing_stop', (data) => {
        const { channelId, receiverId } = data;
        if (channelId) {
            socket.broadcast.emit('user_stop_typing', {
                channelId,
                userId: user.id
            });
        }
        else if (receiverId) {
            const roomName = [user.id, receiverId].sort().join('_');
            socket.to(`dm_${roomName}`).emit('user_stop_typing', {
                userId: user.id
            });
        }
    });
});
// Server'ı başlat
httpServer.listen(PORT, () => {
    console.log(`🚀 Discord Clone Backend running on http://localhost:${PORT}`);
    console.log(`🔒 CORS origin: ${ORIGIN}`);
});
