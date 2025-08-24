import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { User, Server, Channel, Message, ServerMember, Friend, FriendRequest, DirectMessage } from './types';

const dataDir = './data';
const dbFile = path.join(dataDir, 'database.json');

// Data klasörü yoksa oluştur
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Database yapısı
interface Database {
  users: User[];
  servers: Server[];
  channels: Channel[];
  messages: Message[];
  server_members: ServerMember[];
  friends: Friend[];
  friend_requests: FriendRequest[];
  direct_messages: DirectMessage[];
  blocked_users: { id: string; user_id: string; blocked_user_id: string; created_at: string; }[];
  message_reactions: MessageReaction[];
  hidden_conversations: HiddenConversation[];
  conversation_entries: ConversationEntry[]; // YENİ: Mesaj olmadan da conversation takibi için
}

interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

// Gizlenmiş conversation'lar için
interface HiddenConversation {
  id: string;
  user_id: string;
  hidden_user_id: string;
  created_at: string;
}

// YENİ: Conversation entries - mesaj olmadan da conversation'ları takip etmek için
interface ConversationEntry {
  id: string;
  user_id: string;
  other_user_id: string;
  created_at: string;
}

// Varsayılan database
const defaultDb: Database = {
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
  hidden_conversations: [],
  conversation_entries: [] // YENİ
};

// Database'i yükle
let db: Database = defaultDb;

if (fs.existsSync(dbFile)) {
  try {
    const data = fs.readFileSync(dbFile, 'utf8');
    db = { ...defaultDb, ...JSON.parse(data) };
    console.log('✅ Database loaded from file');
  } catch (error) {
    console.error('❌ Error loading database, using default:', error);
    db = defaultDb;
  }
} else {
  console.log('✅ Created new database');
}

// Database'i kaydet
const saveDb = () => {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('❌ Error saving database:', error);
  }
};

// Helper fonksiyonlar
export const database = {
  // Users
  users: {
    findByEmail: (email: string): User | undefined => {
      return db.users.find(u => u.email === email);
    },
    
    findById: (id: string): User | undefined => {
      return db.users.find(u => u.id === id);
    },
    
    findByUsername: (username: string): User | undefined => {
      return db.users.find(u => u.username === username);
    },
    
    searchByUsername: (query: string, excludeId?: string): User[] => {
      return db.users
        .filter(u => u.id !== excludeId && u.username.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10);
    },
    
    create: (userData: Omit<User, 'id' | 'created_at'>): User => {
      const user: User = {
        ...userData,
        id: uuidv4(),
        created_at: new Date().toISOString()
      };
      db.users.push(user);
      saveDb();
      return user;
    }
  },

  // YENİ: Conversation Entries - mesaj olmadan da conversation takibi
  conversationEntries: {
    // Kullanıcının tüm conversation entries'lerini getir
    getByUser: (userId: string): ConversationEntry[] => {
      return db.conversation_entries.filter(ce => ce.user_id === userId);
    },

    // Conversation entry oluştur (eğer yoksa)
    create: (userId: string, otherUserId: string): void => {
      // Zaten var mı kontrol et
      const exists = db.conversation_entries.some(ce => 
        ce.user_id === userId && ce.other_user_id === otherUserId
      );
      
      if (!exists) {
        const entry: ConversationEntry = {
          id: uuidv4(),
          user_id: userId,
          other_user_id: otherUserId,
          created_at: new Date().toISOString()
        };
        db.conversation_entries.push(entry);
        saveDb();
        console.log('Conversation entry created:', { userId, otherUserId });
      }
    },

    // Conversation entry sil
    remove: (userId: string, otherUserId: string): void => {
      db.conversation_entries = db.conversation_entries.filter(ce => 
        !(ce.user_id === userId && ce.other_user_id === otherUserId)
      );
      saveDb();
      console.log('Conversation entry removed:', { userId, otherUserId });
    }
  },

  // Gizlenmiş Conversation'lar
  hiddenConversations: {
    // Kullanıcının gizlediği conversation'ları getir
    getHiddenByUser: (userId: string): string[] => {
      return db.hidden_conversations
        .filter(hc => hc.user_id === userId)
        .map(hc => hc.hidden_user_id);
    },

    // Conversation'ı gizle
    hide: (userId: string, hiddenUserId: string): void => {
      // Zaten gizli mi kontrol et
      const exists = db.hidden_conversations.some(hc => 
        hc.user_id === userId && hc.hidden_user_id === hiddenUserId
      );
      
      if (!exists) {
        const hiddenConv: HiddenConversation = {
          id: uuidv4(),
          user_id: userId,
          hidden_user_id: hiddenUserId,
          created_at: new Date().toISOString()
        };
        db.hidden_conversations.push(hiddenConv);
        saveDb();
        console.log('Conversation gizlendi:', { userId, hiddenUserId });
      }
    },

    // Conversation'ı göster
    unhide: (userId: string, hiddenUserId: string): void => {
      db.hidden_conversations = db.hidden_conversations.filter(hc => 
        !(hc.user_id === userId && hc.hidden_user_id === hiddenUserId)
      );
      saveDb();
      console.log('Conversation gösterildi:', { userId, hiddenUserId });
    },

    // Gizli mi kontrol et
    isHidden: (userId: string, hiddenUserId: string): boolean => {
      return db.hidden_conversations.some(hc => 
        hc.user_id === userId && hc.hidden_user_id === hiddenUserId
      );
    }
  },

  // Message Reactions
  messageReactions: {
    getByMessageId: (messageId: string): MessageReaction[] => {
      return db.message_reactions.filter(r => r.message_id === messageId);
    },

    add: (messageId: string, userId: string, emoji: string): MessageReaction => {
      const reaction: MessageReaction = {
        id: uuidv4(),
        message_id: messageId,
        user_id: userId,
        emoji,
        created_at: new Date().toISOString()
      };
      db.message_reactions.push(reaction);
      saveDb();
      return reaction;
    },

    remove: (messageId: string, userId: string, emoji: string): void => {
      db.message_reactions = db.message_reactions.filter(r => 
        !(r.message_id === messageId && r.user_id === userId && r.emoji === emoji)
      );
      saveDb();
    },

    // Mesaj silme için - belirli mesaj ID'si ile tüm reaction'ları sil
    removeByMessageId: (messageId: string): void => {
      db.message_reactions = db.message_reactions.filter(r => r.message_id !== messageId);
      saveDb();
    },

    getFormattedReactions: (messageId: string): { [emoji: string]: { count: number; users: string[] } } => {
      const reactions = db.message_reactions.filter(r => r.message_id === messageId);
      const formatted: { [emoji: string]: { count: number; users: string[] } } = {};
      
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
    getFriends: (userId: string): (Friend & { friend: User })[] => {
      return db.friends
        .filter(f => f.user_id === userId)
        .map(f => {
          const friend = db.users.find(u => u.id === f.friend_id);
          return { ...f, friend: friend! };
        })
        .filter(f => f.friend);
    },

    areFriends: (userId1: string, userId2: string): boolean => {
      return db.friends.some(f => 
        (f.user_id === userId1 && f.friend_id === userId2) ||
        (f.user_id === userId2 && f.friend_id === userId1)
      );
    },

    addFriend: (userId: string, friendId: string): void => {
      const friendship1: Friend = {
        id: uuidv4(),
        user_id: userId,
        friend_id: friendId,
        created_at: new Date().toISOString()
      };
      const friendship2: Friend = {
        id: uuidv4(),
        user_id: friendId,
        friend_id: userId,
        created_at: new Date().toISOString()
      };
      db.friends.push(friendship1, friendship2);
      saveDb();
    },

    removeFriend: (userId: string, friendId: string): void => {
      db.friends = db.friends.filter(f => 
        !((f.user_id === userId && f.friend_id === friendId) ||
          (f.user_id === friendId && f.friend_id === userId))
      );
      saveDb();
    }
  },

  // Friend Requests
  friendRequests: {
    getPendingReceived: (userId: string): (FriendRequest & { requester: User })[] => {
      return db.friend_requests
        .filter(fr => fr.receiver_id === userId && fr.status === 'pending')
        .map(fr => {
          const requester = db.users.find(u => u.id === fr.requester_id);
          return { ...fr, requester: requester! };
        })
        .filter(fr => fr.requester);
    },

    getPendingSent: (userId: string): (FriendRequest & { receiver: User })[] => {
      return db.friend_requests
        .filter(fr => fr.requester_id === userId && fr.status === 'pending')
        .map(fr => {
          const receiver = db.users.find(u => u.id === fr.receiver_id);
          return { ...fr, receiver: receiver! };
        })
        .filter(fr => fr.receiver);
    },

    findPendingRequest: (requesterId: string, receiverId: string): FriendRequest | undefined => {
      return db.friend_requests.find(fr => 
        fr.requester_id === requesterId && 
        fr.receiver_id === receiverId && 
        fr.status === 'pending'
      );
    },

    create: (requesterId: string, receiverId: string): FriendRequest => {
      const request: FriendRequest = {
        id: uuidv4(),
        requester_id: requesterId,
        receiver_id: receiverId,
        status: 'pending',
        created_at: new Date().toISOString()
      };
      db.friend_requests.push(request);
      saveDb();
      return request;
    },

    updateStatus: (requestId: string, status: 'accepted' | 'rejected'): void => {
      const request = db.friend_requests.find(fr => fr.id === requestId);
      if (request) {
        request.status = status;
        if (status === 'accepted') {
          // Arkadaş olarak ekle
          database.friends.addFriend(request.requester_id, request.receiver_id);
        }
        saveDb();
      }
    }
  },

  // Blocked Users
  blockedUsers: {
    isBlocked: (userId: string, blockedUserId: string): boolean => {
      return db.blocked_users.some(b => b.user_id === userId && b.blocked_user_id === blockedUserId);
    },

    block: (userId: string, blockedUserId: string): void => {
      if (!this.isBlocked(userId, blockedUserId)) {
        const block = {
          id: uuidv4(),
          user_id: userId,
          blocked_user_id: blockedUserId,
          created_at: new Date().toISOString()
        };
        db.blocked_users.push(block);
        
        // Arkadaşlığı kaldır
        database.friends.removeFriend(userId, blockedUserId);
        saveDb();
      }
    },

    unblock: (userId: string, blockedUserId: string): void => {
      db.blocked_users = db.blocked_users.filter(b => 
        !(b.user_id === userId && b.blocked_user_id === blockedUserId)
      );
      saveDb();
    },

    getBlocked: (userId: string): (typeof db.blocked_users[0] & { blocked_user: User })[] => {
      return db.blocked_users
        .filter(b => b.user_id === userId)
        .map(b => {
          const blocked_user = db.users.find(u => u.id === b.blocked_user_id);
          return { ...b, blocked_user: blocked_user! };
        })
        .filter(b => b.blocked_user);
    }
  },

  // Direct Messages
  directMessages: {
    getConversation: (userId1: string, userId2: string | 'all', limit: number = 50): (DirectMessage & { sender: User; reply_to?: any })[] => {
      let messages;
      
      if (userId2 === 'all') {
        // Tüm DM mesajlarını getir (conversations için)
        messages = db.direct_messages
          .filter(dm => dm.sender_id === userId1 || dm.receiver_id === userId1)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .slice(-limit);
      } else {
        // Spesifik iki kullanıcı arasındaki mesajları getir
        messages = db.direct_messages
          .filter(dm => 
            (dm.sender_id === userId1 && dm.receiver_id === userId2) ||
            (dm.sender_id === userId2 && dm.receiver_id === userId1)
          )
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .slice(-limit);
      }

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
        
        return { ...dm, sender: sender!, reply_to };
      })
      .filter(dm => dm.sender);
    },

    create: (senderId: string, receiverId: string, content: string, replyToId?: string): DirectMessage => {
      const dm: DirectMessage = {
        id: uuidv4(),
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

    update: (messageId: string, newContent: string): DirectMessage | null => {
      const messageIndex = db.direct_messages.findIndex(m => m.id === messageId);
      if (messageIndex === -1) return null;
      
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
    findById: (id: string): Server | undefined => {
      return db.servers.find(s => s.id === id);
    },
    
    findByUserId: (userId: string): (Server & { is_owner: boolean })[] => {
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
    
    create: (serverData: Omit<Server, 'id' | 'created_at'>): Server => {
      const server: Server = {
        ...serverData,
        id: uuidv4(),
        created_at: new Date().toISOString()
      };
      
      db.servers.push(server);
      
      // Owner'ı member olarak ekle
      const membership: ServerMember = {
        id: uuidv4(),
        server_id: server.id,
        user_id: server.owner_id,
        joined_at: new Date().toISOString()
      };
      db.server_members.push(membership);
      
      // Varsayılan "general" kanalı oluştur
      const channel: Channel = {
        id: uuidv4(),
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
    findByServerAndUser: (serverId: string, userId: string): ServerMember | undefined => {
      return db.server_members.find(sm => sm.server_id === serverId && sm.user_id === userId);
    },
    
    create: (serverId: string, userId: string): ServerMember => {
      const membership: ServerMember = {
        id: uuidv4(),
        server_id: serverId,
        user_id: userId,
        joined_at: new Date().toISOString()
      };
      db.server_members.push(membership);
      saveDb();
      return membership;
    },

    findByServerId: (serverId: string): ServerMember[] => {
      return db.server_members.filter(sm => sm.server_id === serverId);
    },

    findByUserId: (userId: string): ServerMember[] => {
      return db.server_members.filter(sm => sm.user_id === userId);
    }
  },

  // Channels
  channels: {
    findByServerId: (serverId: string): Channel[] => {
      return db.channels
        .filter(c => c.server_id === serverId)
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
    },
    
    findById: (id: string): Channel | undefined => {
      return db.channels.find(c => c.id === id);
    }
  },

  // Messages
  messages: {
    findByChannelId: (channelId: string, limit: number = 50): (Message & { username: string })[] => {
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
    
    create: (messageData: Omit<Message, 'id' | 'created_at'>): Message => {
      const message: Message = {
        ...messageData,
        id: uuidv4(),
        created_at: new Date().toISOString()
      };
      db.messages.push(message);
      saveDb();
      return message;
    }
  }
};

console.log('✅ Database system initialized');

export default database;