import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server } from 'socket.io';

// Database'i import et - BU SATIR EKSİKTİ
import database from './database';

// Routes
import authRoutes from './routes/auth';
import serverRoutes from './routes/servers';
import friendRoutes from './routes/friends';
import dmRoutes from './routes/dm';

// Middleware
import { authMiddleware } from './middleware/auth';

const PORT = Number(process.env.PORT) || 3001;
const ORIGIN = process.env.ORIGIN || 'http://localhost:3000';

const app = express();

// Middleware
app.use(cors({ 
  origin: ORIGIN,
  credentials: true 
}));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    message: 'Discord Clone Backend is running!'
  });
});

// Routes
app.use('/auth', authRoutes);
app.use('/servers', serverRoutes);
app.use('/friends', friendRoutes);
app.use('/dm', dmRoutes);

// HTTP server oluştur
const httpServer = http.createServer(app);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: ORIGIN,
    methods: ["GET", "POST"]
  }
});

// Connected users tracking
const connectedUsers = new Map<string, string>(); // userId -> socketId mapping

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  
  if (!token) {
    return next(new Error('Authentication error: Missing token'));
  }

  // Express auth middleware'ini re-use et
  const req: any = { 
    headers: { authorization: `Bearer ${token}` } 
  };
  const res: any = { 
    status: () => ({ json: () => {} }) 
  };

  authMiddleware(req, res, (err?: any) => {
    if (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
    
    // Socket'a user bilgisini ekle
    (socket as any).user = req.user;
    next();
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  const user = (socket as any).user;
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
  socket.on('join_server', (serverId: string) => {
    socket.join(`server_${serverId}`);
    console.log(`📡 ${user.username} joined server ${serverId}`);
  });

  // Server'dan ayrılma
  socket.on('leave_server', (serverId: string) => {
    socket.leave(`server_${serverId}`);
    console.log(`📡 ${user.username} left server ${serverId}`);
  });

  // DM room'una katılma
  socket.on('join_dm', (otherUserId: string) => {
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
      const allMessages = database.directMessages.getConversation(user.id, receiverId);
      const originalMessage = allMessages.find(m => m.id === replyToId);
      if (originalMessage && originalMessage.reply_to) {
        reply_to = originalMessage.reply_to;
      } else if (originalMessage) {
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
    } else {
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
    } else {
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
    } else {
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
    } else if (receiverId) {
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
    } else if (receiverId) {
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

export { io };