import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import socketIo from 'socket.io-client';
import { User } from '../types';

interface Notification {
  id: string;
  type: 'dm' | 'server';
  from: User;
  content: string;
  timestamp: string;
  conversationId: string;
}

interface SocketContextType {
  socket: any;
  isConnected: boolean;
  notifications: Notification[];
  unreadCounts: { [conversationId: string]: number };
  markNotificationAsRead: (id: string) => void;
  markConversationAsRead: (conversationId: string) => void;
  clearAllNotifications: () => void;
  sendDM: (receiverId: string, content: string, replyToId?: string) => void; // 3. parametre eklendi
  joinDMRoom: (otherUserId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

interface SocketProviderProps {
  children: ReactNode;
  user: User | null;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children, user }) => {
  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<{ [conversationId: string]: number }>({});

  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const markConversationAsRead = useCallback((conversationId: string) => {
    console.log(`Marking conversation ${conversationId} as read`);
    setUnreadCounts(prev => {
      const newCounts = { ...prev };
      delete newCounts[conversationId]; // Tamamen sil, 0 yapma
      return newCounts;
    });
    setNotifications(prev => prev.filter(n => n.conversationId !== conversationId));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCounts({});
  }, []);

const sendDM = useCallback((receiverId: string, content: string, replyToId?: string) => {
  if (socket && isConnected) {
    console.log(`Sending DM to ${receiverId}: ${content}`, replyToId ? `(replying to: ${replyToId})` : '');
    socket.emit('send_dm', {
      receiverId,
      content,
      replyToId // Yanıt ID'si ekle
    });
  }
}, [socket, isConnected]);

  const joinDMRoom = useCallback((otherUserId: string) => {
    if (socket && isConnected) {
      console.log(`Joining DM room with ${otherUserId}`);
      socket.emit('join_dm', otherUserId);
    }
  }, [socket, isConnected]);

  // Browser bildirim izni iste
  useEffect(() => {
    if (user && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('discord_token');
      if (token) {
        const newSocket = socketIo('http://localhost:3001', {
          auth: { token }
        });

        newSocket.on('connect', () => {
          console.log('Socket connected');
          setIsConnected(true);
        });

        newSocket.on('disconnect', () => {
          console.log('Socket disconnected');
          setIsConnected(false);
        });

        newSocket.on('connected', (data: any) => {
          console.log('Connected to server:', data);
        });

        // Bildirim dinle
        newSocket.on('notification', (data: any) => {
          console.log('Notification received:', data);
          
          const notification: Notification = {
            id: Date.now().toString(),
            type: data.type,
            from: data.from,
            content: data.content,
            timestamp: data.timestamp,
            conversationId: data.type === 'dm' ? data.from.id : data.channelId
          };
          
          setNotifications(prev => [notification, ...prev]);
          
          // Unread count'u artır
          if (data.type === 'dm') {
            setUnreadCounts(prev => ({
              ...prev,
              [data.from.id]: (prev[data.from.id] || 0) + 1
            }));
          }
          
          // Browser bildirimi (izin varsa)
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`${data.from.username} mesaj gönderdi`, {
              body: data.content.length > 50 ? data.content.substring(0, 50) + '...' : data.content,
              icon: '/favicon.ico'
            });
          }
        });

        // DM mesajı dinle - anlık mesajlaşma için
        newSocket.on('new_dm', (data: any) => {
          console.log('New DM received:', data);
          
          // Eğer kullanıcı o conversation'da değilse unread count artır
          const currentPath = window.location.pathname;
          const isInThisDMChat = currentPath.includes(`/dm/${data.sender.id}`) || 
                                (window as any).activeDMUser === data.sender.id;
          
          if (!isInThisDMChat) {
            console.log(`Adding unread count for user ${data.sender.id}`);
            setUnreadCounts(prev => ({
              ...prev,
              [data.sender.id]: (prev[data.sender.id] || 0) + 1
            }));

            // Notification oluştur
            const notification: Notification = {
              id: Date.now().toString(),
              type: 'dm',
              from: data.sender,
              content: data.content,
              timestamp: data.created_at,
              conversationId: data.sender.id
            };
            
            setNotifications(prev => {
              // Aynı kullanıcıdan gelen eski notification'ları güncelle
              const filtered = prev.filter(n => n.conversationId !== data.sender.id);
              return [notification, ...filtered];
            });
          } else {
            console.log(`User is in active DM chat with ${data.sender.id}, not adding unread count`);
          }

          // Custom event dispatch - DMChat component'inin dinlemesi için
          window.dispatchEvent(new CustomEvent('new_dm_message', { detail: data }));
        });

        // Tepki güncellemelerini dinle
        newSocket.on('reaction_update', (data: any) => {
          console.log('Reaction update from socket:', data);
          
          // Custom event dispatch - DMChat component'inin dinlemesi için
          window.dispatchEvent(new CustomEvent('reaction_update', { detail: data }));
        });

        setSocket(newSocket);

        return () => {
          newSocket.close();
          setSocket(null);
          setIsConnected(false);
        };
      }
    } else {
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
    }
  }, [user]);

  const value: SocketContextType = {
    socket,
    isConnected,
    notifications,
    unreadCounts,
    markNotificationAsRead,
    markConversationAsRead,
    clearAllNotifications,
    sendDM,
    joinDMRoom
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};