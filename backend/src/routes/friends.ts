import { Router, Response } from 'express';
import database from '../database';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// Tüm routes auth gerektirir
router.use(authMiddleware);

// Arkadaşları getir
router.get('/', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const friends = database.friends.getFriends(userId);
    res.json({ friends });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to get friends' });
  }
});

// Kullanıcı ara
router.get('/search', (req: AuthRequest, res: Response) => {
  try {
    const { q } = req.query;
    const userId = req.user!.id;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter required' });
    }

    const users = database.users.searchByUsername(q, userId);
    
    // Arkadaşlık durumunu ekle
    const usersWithStatus = users.map(user => {
      const isFriend = database.friends.areFriends(userId, user.id);
      const isBlocked = database.blockedUsers.isBlocked(userId, user.id);
      const pendingRequest = database.friendRequests.findPendingRequest(userId, user.id);
      const receivedRequest = database.friendRequests.findPendingRequest(user.id, userId);
      
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
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Arkadaş isteği gönder
router.post('/request', (req: AuthRequest, res: Response) => {
  try {
    const { user_id } = req.body;
    const requesterId = req.user!.id;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID required' });
    }

    if (user_id === requesterId) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Kullanıcı var mı?
    const targetUser = database.users.findById(user_id);
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Zaten arkadaş mı?
    if (database.friends.areFriends(requesterId, user_id)) {
      return res.status(400).json({ error: 'Already friends' });
    }

    // Engellemiş mi?
    if (database.blockedUsers.isBlocked(user_id, requesterId)) {
      return res.status(400).json({ error: 'Cannot send friend request' });
    }

    // Zaten istek var mı?
    const existingRequest = database.friendRequests.findPendingRequest(requesterId, user_id);
    if (existingRequest) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    // Karşı taraftan istek var mı? (otomatik kabul et)
    const receivedRequest = database.friendRequests.findPendingRequest(user_id, requesterId);
    if (receivedRequest) {
      database.friendRequests.updateStatus(receivedRequest.id, 'accepted');
      return res.json({ message: 'Friend request accepted', auto_accepted: true });
    }

    // Yeni istek oluştur
    const request = database.friendRequests.create(requesterId, user_id);
    res.json({ request, message: 'Friend request sent' });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Arkadaş isteklerini getir
router.get('/requests', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const received = database.friendRequests.getPendingReceived(userId);
    const sent = database.friendRequests.getPendingSent(userId);
    
    res.json({ received, sent });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'Failed to get friend requests' });
  }
});

// Arkadaş isteğini kabul et/reddet
router.patch('/requests/:requestId', (req: AuthRequest, res: Response) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body; // 'accept' or 'reject'
    const userId = req.user!.id;

    if (!['accept', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // İstek var mı ve bu kullanıcıya mı?
    const request = database.friendRequests.getPendingReceived(userId)
      .find(r => r.id === requestId);
    
    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const status = action === 'accept' ? 'accepted' : 'rejected';
    database.friendRequests.updateStatus(requestId, status);

    res.json({ message: `Friend request ${status}` });
  } catch (error) {
    console.error('Handle friend request error:', error);
    res.status(500).json({ error: 'Failed to handle friend request' });
  }
});

// Arkadaşı kaldır
router.delete('/:friendId', (req: AuthRequest, res: Response) => {
  try {
    const { friendId } = req.params;
    const userId = req.user!.id;

    if (!database.friends.areFriends(userId, friendId)) {
      return res.status(400).json({ error: 'Not friends' });
    }

    database.friends.removeFriend(userId, friendId);
    res.json({ message: 'Friend removed' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Failed to remove friend' });
  }
});

// Kullanıcıyı engelle
router.post('/block', (req: AuthRequest, res: Response) => {
  try {
    const { user_id } = req.body;
    const userId = req.user!.id;

    if (!user_id) {
      return res.status(400).json({ error: 'User ID required' });
    }

    if (user_id === userId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    database.blockedUsers.block(userId, user_id);
    res.json({ message: 'User blocked' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Kullanıcının engelini kaldır
router.delete('/block/:blockedUserId', (req: AuthRequest, res: Response) => {
  try {
    const { blockedUserId } = req.params;
    const userId = req.user!.id;

    database.blockedUsers.unblock(userId, blockedUserId);
    res.json({ message: 'User unblocked' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// Engellenen kullanıcıları getir
router.get('/blocked', (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const blocked = database.blockedUsers.getBlocked(userId);
    res.json({ blocked });
  } catch (error) {
    console.error('Get blocked users error:', error);
    res.status(500).json({ error: 'Failed to get blocked users' });
  }
});

export default router;