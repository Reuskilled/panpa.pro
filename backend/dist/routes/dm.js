import { Router, Response } from 'express';
import database from '../database';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// Tüm routes auth gerektirir
router.use(authMiddleware);

// YENİ: Kullanıcının tüm DM konuşmalarını getir
router.get('/conversations', (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user!.id;
    
    console.log('Getting conversations for user:', currentUserId);

    // Kullanıcının gizlediği conversation'ları al
    const hiddenUserIds = database.hiddenConversations ? 
      database.hiddenConversations.getHiddenByUser(currentUserId) : [];
    
    console.log('Hidden conversations:', hiddenUserIds);

    // 1. Mesajlardan conversation'ları al
    const allMessages = database.directMessages.getConversation(currentUserId, 'all', 1000);
    const messageConversationMap = new Map();
    
    allMessages.forEach(message => {
      const otherUserId = message.sender_id === currentUserId ? message.receiver_id : message.sender_id;
      
      // Gizlenmiş conversation'ları atla
      if (hiddenUserIds.includes(otherUserId)) {
        return;
      }
      
      if (!messageConversationMap.has(otherUserId) || 
          new Date(message.created_at).getTime() > new Date(messageConversationMap.get(otherUserId).created_at).getTime()) {
        messageConversationMap.set(otherUserId, message);
      }
    });

    // 2. Conversation entries'lerden de al (mesaj olmasa bile)
    const conversationEntries = database.conversationEntries ? 
      database.conversationEntries.getByUser(currentUserId) : [];
    
    console.log('Conversation entries:', conversationEntries.length);

    // 3. İkisini birleştir
    const allConversations = new Map();

    // Önce mesajlardan gelen conversation'ları ekle
    messageConversationMap.forEach((message, otherUserId) => {
      allConversations.set(otherUserId, {
        type: 'message',
        data: message,
        created_at: message.created_at
      });
    });

    // Sonra conversation entries'leri ekle (eğer zaten yoksa)
    conversationEntries.forEach(entry => {
      if (!hiddenUserIds.includes(entry.other_user_id) && !allConversations.has(entry.other_user_id)) {
        allConversations.set(entry.other_user_id, {
          type: 'entry',
          data: entry,
          created_at: entry.created_at
        });
      }
    });

    // 4. Conversation'ları array'e çevir ve kullanıcı bilgileriyle zenginleştir
    const conversations = Array.from(allConversations.entries()).map(([otherUserId, convData]) => {
      const otherUser = database.users.findById(otherUserId);
      
      if (!otherUser) {
        return null;
      }

      if (convData.type === 'message') {
        // Mesaj varsa
        return {
          other_user: {
            id: otherUser.id,
            username: otherUser.username,
            avatar_url: otherUser.avatar_url
          },
          lastMessage: {
            id: convData.data.id,
            content: convData.data.content,
            created_at: convData.data.created_at,
            sender_id: convData.data.sender_id
          },
          hasUnread: false
        };
      } else {
        // Sadece conversation entry varsa (henüz mesaj yok)
        return {
          other_user: {
            id: otherUser.id,
            username: otherUser.username,
            avatar_url: otherUser.avatar_url
          },
          lastMessage: {
            id: 'placeholder',
            content: 'Konuşma başlatıldı', // Placeholder mesaj
            created_at: convData.data.created_at,
            sender_id: currentUserId
          },
          hasUnread: false
        };
      }
    }).filter(conv => conv !== null);

    // Son mesaj/oluşturma zamanına göre sırala (en yeni önce)
    conversations.sort((a, b) => 
      new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );

    console.log('Returning conversations:', conversations.length);
    
    res.json({ 
      conversations: conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// YENİ: Conversation entry oluşturma endpoint'i
router.post('/conversations/:userId/create', (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.id;

    console.log('Creating conversation entry:', { currentUserId, userId });

    // Kullanıcı var mı?
    const targetUser = database.users.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Conversation entry oluştur (eğer yoksa)
    if (database.conversationEntries) {
      database.conversationEntries.create(currentUserId, userId);
    }

    // Aynı zamanda unhide et
    if (database.hiddenConversations) {
      database.hiddenConversations.unhide(currentUserId, userId);
    }

    res.json({ message: 'Conversation entry created successfully' });
  } catch (error) {
    console.error('Create conversation entry error:', error);
    res.status(500).json({ error: 'Failed to create conversation entry' });
  }
});

// YENİ: Conversation gizleme endpoint'i
router.post('/conversations/:userId/hide', (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.id;

    console.log('Hiding conversation:', { currentUserId, userId });

    if (database.hiddenConversations) {
      database.hiddenConversations.hide(currentUserId, userId);
    }

    res.json({ message: 'Conversation hidden successfully' });
  } catch (error) {
    console.error('Hide conversation error:', error);
    res.status(500).json({ error: 'Failed to hide conversation' });
  }
});

// YENİ: Conversation gösterme endpoint'i
router.post('/conversations/:userId/unhide', (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.id;

    console.log('Unhiding conversation:', { currentUserId, userId });

    if (database.hiddenConversations) {
      database.hiddenConversations.unhide(currentUserId, userId);
    }

    res.json({ message: 'Conversation unhidden successfully' });
  } catch (error) {
    console.error('Unhide conversation error:', error);
    res.status(500).json({ error: 'Failed to unhide conversation' });
  }
});

// DM konuşmasını getir
router.get('/:userId', (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!.id;

    console.log('DM Request:', { currentUserId, targetUserId: userId });

    // Kullanıcı var mı?
    const targetUser = database.users.findById(userId);
    if (!targetUser) {
      console.log('Target user not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    // Engelleme kontrolü (eğer varsa)
    try {
      if (database.blockedUsers && database.blockedUsers.isBlocked && database.blockedUsers.isBlocked(userId, currentUserId)) {
        console.log('User is blocked:', { userId, currentUserId });
        return res.status(403).json({ error: 'Cannot message this user' });
      }
    } catch (blockError) {
      console.log('Block check failed (probably not implemented):', blockError.message);
      // Engelleme kontrolü yoksa devam et
    }

    // Mesajları al
    const messages = database.directMessages.getConversation(currentUserId, userId);
    console.log('Found messages:', messages.length);
    
    // Her mesaj için tepkileri ekle (eğer varsa)
    const messagesWithReactions = messages.map(message => ({
      ...message,
      reactions: database.messageReactions ? 
        database.messageReactions.getFormattedReactions(message.id) : 
        undefined,
    }));
    
    console.log('Returning conversation:', { 
      messageCount: messagesWithReactions.length,
      targetUser: targetUser.username 
    });
    
    res.json({ 
      messages: messagesWithReactions,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        avatar_url: targetUser.avatar_url
      }
    });
  } catch (error) {
    console.error('Get DM conversation error:', error);
    res.status(500).json({ error: 'Failed to get conversation' });
  }
});

// DM gönder
router.post('/:userId', (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.params;
    const { content, reply_to_id } = req.body;
    const senderId = req.user!.id;

    console.log('Sending DM:', { senderId, userId, contentLength: content?.length });

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content required' });
    }

    if (content.length > 2000) {
      return res.status(400).json({ error: 'Message too long' });
    }

    // Kullanıcı var mı?
    const targetUser = database.users.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Engelleme kontrolü (eğer varsa)
    try {
      if (database.blockedUsers && database.blockedUsers.isBlocked && database.blockedUsers.isBlocked(userId, senderId)) {
        return res.status(403).json({ error: 'Cannot message this user' });
      }
    } catch (blockError) {
      console.log('Block check failed (probably not implemented):', blockError.message);
      // Engelleme kontrolü yoksa devam et
    }

    // Mesajı oluştur
    const message = database.directMessages.create(senderId, userId, content.trim(), reply_to_id);
    
    // Mesaj gönderildiğinde karşı taraf için conversation'ı otomatik unhide et
    if (database.hiddenConversations) {
      database.hiddenConversations.unhide(userId, senderId);
    }
    
    // Yanıt bilgisini hazırla
    let reply_to = undefined;
    if (reply_to_id) {
      try {
        const allMessages = database.directMessages.getConversation(senderId, userId);
        const originalMessage = allMessages.find(m => m.id === reply_to_id);
        if (originalMessage) {
          reply_to = originalMessage.reply_to || {
            id: originalMessage.id,
            content: originalMessage.content,
            sender: originalMessage.sender
          };
        }
      } catch (replyError) {
        console.log('Reply processing failed:', replyError.message);
        // Yanıt işleme başarısız olursa devam et
      }
    }

    const messageWithReactions = {
      ...message,
      reactions: database.messageReactions ? 
        database.messageReactions.getFormattedReactions(message.id) : 
        undefined,
      sender: {
        id: req.user!.id,
        username: req.user!.username
      },
      reply_to: reply_to
    };
    
    console.log('DM sent successfully:', { messageId: message.id });
    
    res.json({ 
      message: messageWithReactions
    });
  } catch (error) {
    console.error('Send DM error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Reaction ekleme/çıkarma endpoint'i
router.post('/:userId/reactions/:messageId', (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user!.id;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji required' });
    }

    // Mesaj reactions sistemi yoksa basit hata dön
    if (!database.messageReactions) {
      return res.status(501).json({ error: 'Reactions not implemented yet' });
    }

    // Mesaj var mı kontrol et
    const allMessages = database.directMessages.getConversation(userId, req.params.userId);
    const messageExists = allMessages.some(m => m.id === messageId);
    
    if (!messageExists) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Mevcut reaction var mı?
    const existingReactions = database.messageReactions.getByMessageId(messageId);
    const userReaction = existingReactions.find(r => r.user_id === userId && r.emoji === emoji);

    if (userReaction) {
      // Reaction'ı kaldır
      database.messageReactions.remove(messageId, userId, emoji);
    } else {
      // Reaction ekle
      database.messageReactions.add(messageId, userId, emoji);
    }

    // Güncel reactions'ları al
    const updatedReactions = database.messageReactions.getFormattedReactions(messageId);

    res.json({ 
      reactions: updatedReactions,
      action: userReaction ? 'removed' : 'added'
    });
  } catch (error) {
    console.error('Reaction error:', error);
    res.status(500).json({ error: 'Failed to handle reaction' });
  }
});

// Mesaj düzenleme endpoint'i
router.patch('/:userId/messages/:messageId', (req: AuthRequest, res: Response) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user!.id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content required' });
    }

    if (content.length > 2000) {
      return res.status(400).json({ error: 'Message too long' });
    }

    // Mesaj düzenleme sistemi yoksa hata dön
    if (!database.directMessages.update) {
      return res.status(501).json({ error: 'Message editing not implemented yet' });
    }

    // Mesaj var mı ve kullanıcının mesajı mı kontrol et
    const allMessages = database.directMessages.getConversation(userId, req.params.userId);
    const message = allMessages.find(m => m.id === messageId && m.sender_id === userId);
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found or not authorized' });
    }

    // Mesajı güncelle
    const updatedMessage = database.directMessages.update(messageId, content.trim());
    
    if (!updatedMessage) {
      return res.status(500).json({ error: 'Failed to update message' });
    }

    // Mesajı tepkileriyle birlikte döndür
    const messageWithReactions = {
      ...updatedMessage,
      reactions: database.messageReactions ? 
        database.messageReactions.getFormattedReactions(messageId) : 
        undefined,
      sender: {
        id: req.user!.id,
        username: req.user!.username
      }
    };
    
    res.json({ 
      message: messageWithReactions
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({ error: 'Failed to edit message' });
  }
});

export default router;