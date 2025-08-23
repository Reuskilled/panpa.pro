import { Router, Response } from 'express';
import database from '../database';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// Tüm routes auth gerektirir
router.use(authMiddleware);




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
    database.hiddenConversations.unhide(userId, senderId);
    
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