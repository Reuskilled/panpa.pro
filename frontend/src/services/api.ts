const API_BASE = 'http://localhost:3001';

const getAuthHeader = (): HeadersInit => {
  const token = localStorage.getItem('discord_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
};

export const authApi = {
  login: async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return response.json();
  },

  register: async (username: string, email: string, password: string) => {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    return response.json();
  },
};

export const serverApi = {
  getAll: async () => {
    const response = await fetch(`${API_BASE}/servers`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch servers');
    return response.json();
  },

  create: async (name: string, description?: string) => {
    const response = await fetch(`${API_BASE}/servers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ name, description }),
    });
    if (!response.ok) throw new Error('Failed to create server');
    return response.json();
  },

  getDetails: async (serverId: string) => {
    const response = await fetch(`${API_BASE}/servers/${serverId}`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch server details');
    return response.json();
  },

  createInvite: async (serverId: string) => {
    const response = await fetch(`${API_BASE}/servers/${serverId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });
    if (!response.ok) throw new Error('Failed to create invite');
    return response.json();
  },

  joinByInvite: async (inviteCode: string) => {
    const response = await fetch(`${API_BASE}/servers/join-by-invite/${inviteCode}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });
    if (!response.ok) throw new Error('Failed to join server');
    return response.json();
  },
};

export const friendsApi = {
  getFriends: async () => {
    const response = await fetch(`${API_BASE}/friends`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch friends');
    return response.json();
  },

  searchUsers: async (query: string) => {
    const response = await fetch(`${API_BASE}/friends/search?q=${encodeURIComponent(query)}`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to search users');
    return response.json();
  },

  sendFriendRequest: async (userId: string) => {
    const response = await fetch(`${API_BASE}/friends/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!response.ok) throw new Error('Failed to send friend request');
    return response.json();
  },

  getFriendRequests: async () => {
    const response = await fetch(`${API_BASE}/friends/requests`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch friend requests');
    return response.json();
  },

  handleFriendRequest: async (requestId: string, action: 'accept' | 'reject') => {
    const response = await fetch(`${API_BASE}/friends/requests/${requestId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) throw new Error('Failed to handle friend request');
    return response.json();
  },

  removeFriend: async (friendId: string) => {
    const response = await fetch(`${API_BASE}/friends/${friendId}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to remove friend');
    return response.json();
  },

  blockUser: async (userId: string) => {
    const response = await fetch(`${API_BASE}/friends/block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!response.ok) throw new Error('Failed to block user');
    return response.json();
  },

  unblockUser: async (userId: string) => {
    const response = await fetch(`${API_BASE}/friends/block/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to unblock user');
    return response.json();
  },

  getBlockedUsers: async () => {
    const response = await fetch(`${API_BASE}/friends/blocked`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch blocked users');
    return response.json();
  },
};

export const dmApi = {
  // Tüm DM konuşmalarını getir - YENİ
  getConversations: async () => {
    console.log('dmApi.getConversations called');
    try {
      const response = await fetch(`${API_BASE}/dm/conversations`, {
        headers: getAuthHeader(),
      });
      
      console.log('Conversations response status:', response.status);
      console.log('Conversations response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Conversations error response:', errorText);
        throw new Error(`Failed to fetch conversations: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Conversations data:', data);
      return data;
    } catch (error) {
      console.error('getConversations error:', error);
      throw new Error('Failed to fetch conversations');
    }
  },

  // Conversation gizleme - YENİ
  hideConversation: async (userId: string) => {
    console.log('dmApi.hideConversation called for user:', userId);
    try {
      const response = await fetch(`${API_BASE}/dm/conversations/${userId}/hide`, {
        method: 'POST',
        headers: getAuthHeader(),
      });
      
      console.log('Hide conversation response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Hide conversation error response:', errorText);
        throw new Error(`Failed to hide conversation: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Hide conversation success:', data);
      return data;
    } catch (error) {
      console.error('hideConversation error:', error);
      throw new Error('Failed to hide conversation');
    }
  },

  // Conversation gösterme - YENİ
  unhideConversation: async (userId: string) => {
    console.log('dmApi.unhideConversation called for user:', userId);
    try {
      const response = await fetch(`${API_BASE}/dm/conversations/${userId}/unhide`, {
        method: 'POST',
        headers: getAuthHeader(),
      });
      
      console.log('Unhide conversation response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Unhide conversation error response:', errorText);
        throw new Error(`Failed to unhide conversation: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Unhide conversation success:', data);
      return data;
    } catch (error) {
      console.error('unhideConversation error:', error);
      throw new Error('Failed to unhide conversation');
    }
  },

  // Conversation entry oluşturma - YENİ
  createConversation: async (userId: string) => {
    console.log('dmApi.createConversation called for user:', userId);
    try {
      const response = await fetch(`${API_BASE}/dm/conversations/${userId}/create`, {
        method: 'POST',
        headers: getAuthHeader(),
      });
      
      console.log('Create conversation response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Create conversation error response:', errorText);
        throw new Error(`Failed to create conversation: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Create conversation success:', data);
      return data;
    } catch (error) {
      console.error('createConversation error:', error);
      throw new Error('Failed to create conversation');
    }
  },

  // DM konuşmasını getir
  getConversation: async (userId: string) => {
    const response = await fetch(`${API_BASE}/dm/${userId}`, {
      headers: getAuthHeader(),
    });
    if (!response.ok) throw new Error('Failed to fetch conversation');
    return response.json();
  },

  editMessage: async (userId: string, messageId: string, content: string) => {
    const response = await fetch(`${API_BASE}/dm/${userId}/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) throw new Error('Failed to edit message');
    return response.json();
  },

  // DM gönder
  sendMessage: async (userId: string, content: string, replyToId?: string) => {
    const response = await fetch(`${API_BASE}/dm/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ content, reply_to_id: replyToId }),
    });
    if (!response.ok) throw new Error('Failed to send message');
    return response.json();
  },

  // Tepki ekleme/çıkarma
  addReaction: async (userId: string, messageId: string, emoji: string) => {
    const response = await fetch(`${API_BASE}/dm/${userId}/reactions/${messageId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify({ emoji }),
    });
    if (!response.ok) throw new Error('Failed to add reaction');
    return response.json();
  },
};