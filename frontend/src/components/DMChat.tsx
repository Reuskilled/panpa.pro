import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, DirectMessage, Server } from '../types';
import { dmApi } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import MessageContent from './MessageContent';

// Mesaj tipi genişletildi - reactions, updated_at ve reply_to eklendi
interface MessageWithReactions extends DirectMessage {
  sender: User;
  updated_at?: string;
  reply_to?: {
    id: string;
    content: string;
    sender: User;
  };
  reactions?: {
    [emoji: string]: {
      count: number;
      users: string[]; // user ID'leri
    };
  };
}

interface DMChatProps {
  currentUser: User;
  targetUser: User;
  onClose: () => void;
  showNewMessageDivider?: boolean;
  onServerSelect?: (server: Server) => void; // Sunucu seçimi için callback
}

const DMChat: React.FC<DMChatProps> = ({ currentUser, targetUser, onClose, showNewMessageDivider = false, onServerSelect }) => {
  const [messages, setMessages] = useState<MessageWithReactions[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(true);
  const [hasReplied, setHasReplied] = useState(false);
  const [shouldShowDivider, setShouldShowDivider] = useState(true);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; messageId: string | null }>({
    visible: false,
    x: 0,
    y: 0,
    messageId: null
  });
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [replyingToMessage, setReplyingToMessage] = useState<MessageWithReactions | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { sendDM, joinDMRoom, markConversationAsRead, socket } = useSocket();

  // Geçici mesaj kontrolü için yardımcı fonksiyon
  const isTemporaryMessage = (id: string) => {
    return typeof id === 'string' && id.startsWith('temp_');
  };

  // Mesajları yükle
  const loadConversation = useCallback(async () => {
    try {
      setLoading(true);
      const response = await dmApi.getConversation(targetUser.id);
      const sortedMessages = (response.messages || []).sort((a: DirectMessage & { sender: User }, b: DirectMessage & { sender: User }) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      setMessages(sortedMessages);
      
      // Son okunmuş mesajı localStorage'dan al
      const lastReadKey = `lastRead_${currentUser.id}_${targetUser.id}`;
      const savedLastRead = localStorage.getItem(lastReadKey);
      setLastReadMessageId(savedLastRead);
      
    } catch (error) {
      console.error('Failed to load conversation:', error);
    } finally {
      setLoading(false);
    }
  }, [targetUser.id, currentUser.id]);

  // Component mount edildiğinde
  useEffect(() => {
    console.log('DMChat mounted for user:', targetUser.username);
    
    (window as any).activeDMUser = targetUser.id;
    
    loadConversation().then(() => {
      // Mesajlar yüklendikten sonra en alta scroll et
      setTimeout(() => {
        scrollToBottom();
        setHasScrolledToBottom(true);
      }, 100);
    });
    joinDMRoom(targetUser.id);
    
    return () => {
      (window as any).activeDMUser = null;
    };
  }, [targetUser.id, joinDMRoom, loadConversation]);

  // Context menu'yu kapat
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
    };

    if (contextMenu.visible) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [contextMenu.visible]);

  // Tepki ekleme fonksiyonu - DÜZELTILMIŞ
  const handleAddReaction = async (messageId: string, emoji: string) => {
    // Geçici mesajlara tepki vermeyi engelle
    if (isTemporaryMessage(messageId)) {
      console.log('Geçici mesajlara tepki verilemez:', messageId);
      return;
    }

    try {
      // Optimistic update - UI'ı hemen güncelle
      setMessages(prev => prev.map(msg => {
        if (msg.id === messageId) {
          const reactions = { ...msg.reactions } || {};
          
          // Mevcut tepki var mı?
          if (reactions[emoji]) {
            // Kullanıcı zaten tepki vermiş mi?
            if (reactions[emoji].users.includes(currentUser.id)) {
              // Tepkiyi geri çek
              reactions[emoji] = {
                ...reactions[emoji],
                count: reactions[emoji].count - 1,
                users: reactions[emoji].users.filter((id: string) => id !== currentUser.id)
              };
              
              // Count 0 ise tepkiyi tamamen sil
              if (reactions[emoji].count === 0) {
                delete reactions[emoji];
              }
            } else {
              // Tepki ekle
              reactions[emoji] = {
                ...reactions[emoji],
                count: reactions[emoji].count + 1,
                users: [...reactions[emoji].users, currentUser.id]
              };
            }
          } else {
            // Yeni tepki oluştur
            reactions[emoji] = {
              count: 1,
              users: [currentUser.id]
            };
          }

          // KRITIK: TÜM mesaj özelliklerini koru, sadece reactions'ı güncelle
          const updatedMessage = {
            ...msg, // TÜM mevcut mesaj bilgilerini koru (reply_to, sender, updated_at, vs.)
            reactions: Object.keys(reactions).length > 0 ? reactions : undefined
          };

          // Socket ile karşı tarafa gönder
          if (socket) {
            socket.emit('reaction_update', {
              messageId,
              emoji,
              userId: currentUser.id,
              username: currentUser.username,
              action: reactions[emoji] && reactions[emoji].users.includes(currentUser.id) ? 'add' : 'remove',
              reactions: updatedMessage.reactions,
              conversationId: targetUser.id
            });
          }

          return updatedMessage;
        }
        return msg;
      }));

      // API'ye tepki gönder
      await dmApi.addReaction(targetUser.id, messageId, emoji);

      console.log('Tepki başarıyla gönderildi:', messageId, emoji);
    } catch (error) {
      console.error('Tepki gönderilirken hata:', error);
      
      // Hata durumunda optimistic update'i geri al
      loadConversation();
    }
  };

  const handleReplyToMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message) {
      setReplyingToMessage(message);
      setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
      console.log('Mesaja yanıt:', messageId);
    }
  };

  const handleCancelReply = () => {
    setReplyingToMessage(null);
  };

  const handleEditMessage = (messageId: string) => {
    const message = messages.find(m => m.id === messageId);
    if (message && message.sender_id === currentUser.id) {
      setEditingMessageId(messageId);
      setEditingContent(message.content);
    }
  };

  // Mesaj düzenleme kaydetme
  const handleSaveEdit = async (messageId: string) => {
    if (!editingContent.trim()) return;
    
    const originalMessage = messages.find(m => m.id === messageId);
    if (!originalMessage) return;

    try {
      // Optimistic update
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? { ...msg, content: editingContent.trim(), updated_at: new Date().toISOString() }
          : msg
      ));
      
      setEditingMessageId(null);
      setEditingContent('');

      // Socket ile karşı tarafa anlık gönder
      if (socket) {
        socket.emit('message_edit', {
          messageId,
          content: editingContent.trim(),
          userId: currentUser.id,
          username: currentUser.username,
          conversationId: targetUser.id,
          updated_at: new Date().toISOString()
        });
      }

      // API'ye gönder
      await dmApi.editMessage(targetUser.id, messageId, editingContent.trim());
      
      console.log('Mesaj başarıyla düzenlendi:', messageId, editingContent);
    } catch (error) {
      console.error('Mesaj düzenlenirken hata:', error);
      
      // Hata durumunda geri al
      setMessages(prev => prev.map(msg => 
        msg.id === messageId 
          ? originalMessage
          : msg
      ));
      setEditingMessageId(messageId);
      setEditingContent(originalMessage.content);
    }
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingContent('');
  };

  const handleDeleteMessage = (messageId: string) => {
    if (window.confirm('Bu mesajı silmek istediğinizden emin misiniz?')) {
      setMessages(prev => prev.filter(msg => msg.id !== messageId));
      console.log('Mesaj silindi:', messageId);
    }
  };

  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content);
    console.log('Mesaj kopyalandı:', content);
  };

  const handleCopyMessageLink = (messageId: string) => {
    const link = `${window.location.origin}/dm/${targetUser.id}/${messageId}`;
    navigator.clipboard.writeText(link);
    console.log('Mesaj linki kopyalandı:', link);
  };

  const handleMarkUnread = (messageId: string) => {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex > 0) {
      const previousMessage = messages[messageIndex - 1];
      const lastReadKey = `lastRead_${currentUser.id}_${targetUser.id}`;
      localStorage.setItem(lastReadKey, previousMessage.id);
      setLastReadMessageId(previousMessage.id);
      console.log('Okunmadı olarak işaretlendi:', messageId);
    }
  };

  // Prop değiştiğinde state'i güncelle
  useEffect(() => {
    setShouldShowDivider(showNewMessageDivider && !hasReplied);
    console.log('DMChat Debug:', { 
      showNewMessageDivider, 
      hasReplied, 
      shouldShowDivider: showNewMessageDivider && !hasReplied 
    });
  }, [showNewMessageDivider, hasReplied]);

  // Mesajları okundu olarak işaretle - sadece manuel olarak çağrılacak
  const markAsReadManually = useCallback(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const lastReadKey = `lastRead_${currentUser.id}_${targetUser.id}`;
      localStorage.setItem(lastReadKey, lastMessage.id);
      setLastReadMessageId(lastMessage.id);
      markConversationAsRead(targetUser.id);
    }
  }, [messages, currentUser.id, targetUser.id, markConversationAsRead]);

  // Real-time mesaj dinleme ve mesaj düzenleme dinleme
  useEffect(() => {
    const handleNewDMMessage = (event: CustomEvent) => {
      const data = event.detail;
      console.log('DMChat received new message event:', data);
      
      if (data.sender_id === targetUser.id || data.receiver_id === targetUser.id) {
        const messageWithSender = {
          ...data,
          sender: data.sender
        };
        
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === data.id);
          if (exists) {
            return prev;
          }
          
          const newMessages = [...prev, messageWithSender].sort((a: DirectMessage & { sender: User }, b: DirectMessage & { sender: User }) => 
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          );
          return newMessages;
        });

        // Sohbetteyken gelen mesajları otomatik okundu say
        if (data.sender_id === targetUser.id) {
          setTimeout(() => {
            const lastReadKey = `lastRead_${currentUser.id}_${targetUser.id}`;
            localStorage.setItem(lastReadKey, data.id);
            setLastReadMessageId(data.id);
            markConversationAsRead(targetUser.id);
          }, 100);
        }
      }
    };

    // Tepki güncellemelerini dinle - DÜZELTILMIŞ
    const handleReactionUpdate = (event: CustomEvent) => {
      const data = event.detail;
      console.log('Reaction update received:', data);

      // Bu conversation'a ait mi kontrol et
      if (data.conversationId === targetUser.id || data.conversationId === currentUser.id) {
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.messageId) {
            return {
              ...msg, // TÜM mevcut mesaj bilgilerini koru (reply_to, sender, vs.)
              reactions: data.reactions
            };
          }
          return msg;
        }));
        
        console.log('Tepki güncellendi:', data.messageId, data.emoji);
      }
    };

    // Mesaj düzenleme dinleyicisi
    const handleMessageEdit = (event: CustomEvent) => {
      const data = event.detail;
      console.log('Message edit received:', data);

      // Bu conversation'a ait mi kontrol et
      if (data.conversationId === targetUser.id || data.conversationId === currentUser.id) {
        setMessages(prev => prev.map(msg => {
          if (msg.id === data.messageId) {
            return {
              ...msg,
              content: data.content,
              updated_at: data.updated_at
            };
          }
          return msg;
        }));
        
        console.log('Mesaj düzenleme güncellendi:', data.messageId);
      }
    };

    // Socket dinleyicilerini ekle
    if (socket) {
      socket.on('reaction_update', (data: any) => {
        console.log('Direct socket reaction update:', data);
        handleReactionUpdate({ detail: data } as CustomEvent);
      });

      socket.on('message_edit', (data: any) => {
        console.log('Direct socket message edit:', data);
        handleMessageEdit({ detail: data } as CustomEvent);
      });
    }

    window.addEventListener('new_dm_message', handleNewDMMessage as EventListener);
    window.addEventListener('reaction_update', handleReactionUpdate as EventListener);
    window.addEventListener('message_edit', handleMessageEdit as EventListener);
    
    return () => {
      if (socket) {
        socket.off('reaction_update');
        socket.off('message_edit');
      }
      window.removeEventListener('new_dm_message', handleNewDMMessage as EventListener);
      window.removeEventListener('reaction_update', handleReactionUpdate as EventListener);
      window.removeEventListener('message_edit', handleMessageEdit as EventListener);
    };
  }, [targetUser.id, currentUser.id, markConversationAsRead, socket, loadConversation]);

  // Scroll kontrol - sadece pozisyon takibi için
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setHasScrolledToBottom(isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Otomatik scroll - sadece kullanıcı en alttaysa
  useEffect(() => {
    if (hasScrolledToBottom) {
      scrollToBottom();
    }
  }, [messages, hasScrolledToBottom]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Real-time mesaj gönderme
const handleSendMessage = async (e: React.FormEvent) => {
  e.preventDefault();
  
  if (!newMessage.trim() || sending) return;

  const messageContent = newMessage.trim();
  const replyToId = replyingToMessage?.id; // replyToId'yi önceden al
  
  setNewMessage('');
  setSending(true);

  try {
    const optimisticMessage = {
      id: `temp_${Date.now()}`,
      sender_id: currentUser.id,
      receiver_id: targetUser.id,
      content: messageContent,
      created_at: new Date().toISOString(),
      sender: currentUser,
      reply_to_id: replyToId, // reply_to_id'yi ekle
      // Yanıtlama bilgisi ekle
      reply_to: replyingToMessage ? {
        id: replyingToMessage.id,
        content: replyingToMessage.content,
        sender: replyingToMessage.sender
      } : undefined
    };
    
    console.log('Optimistic message with reply:', optimisticMessage); // Debug log
    
    setMessages(prev => {
      const newMessages = [...prev, optimisticMessage].sort((a: DirectMessage & { sender: User }, b: DirectMessage & { sender: User }) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      const lastMessage = newMessages[newMessages.length - 1];
      if (lastMessage) {
        const lastReadKey = `lastRead_${currentUser.id}_${targetUser.id}`;
        localStorage.setItem(lastReadKey, lastMessage.id);
        setLastReadMessageId(lastMessage.id);
      }
      
      return newMessages;
    });

    // Yanıtlamayı temizle
    setReplyingToMessage(null);

    setHasScrolledToBottom(true);
    setHasReplied(true);
    setShouldShowDivider(false);
    markAsReadManually();

    // Socket'e replyToId ile gönder
    console.log('Sending DM with replyToId:', replyToId); // Debug log
    sendDM(targetUser.id, messageContent, replyToId);

    try {
      // API çağrısına reply_to bilgisini ekle
      await dmApi.sendMessage(targetUser.id, messageContent, replyToId);
    } catch (apiError) {
      console.error('API call failed, but socket message sent:', apiError);
    }
    
  } catch (error) {
    console.error('Failed to send message:', error);
    setNewMessage(messageContent);
  } finally {
    setSending(false);
  }
};

  // Typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('tr-TR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('tr-TR', { 
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  const getAvatarInitial = (username: string) => {
    return username.charAt(0).toUpperCase();
  };

  // Okunmamış mesajları belirle - basit mantık
  const getFirstUnreadTargetMessageIndex = () => {
    if (!lastReadMessageId) {
      // Hiç okunmamışsa ilk targetUser mesajını bul
      return messages.findIndex(msg => msg.sender_id === targetUser.id);
    }
    
    const lastReadIndex = messages.findIndex(msg => msg.id === lastReadMessageId);
    if (lastReadIndex === -1) return -1;
    
    // Son okunan mesajdan sonraki ilk targetUser mesajını bul
    for (let i = lastReadIndex + 1; i < messages.length; i++) {
      if (messages[i].sender_id === targetUser.id) {
        return i;
      }
    }
    return -1;
  };

  const firstUnreadTargetIndex = getFirstUnreadTargetMessageIndex();
  const hasUnreadMessages = firstUnreadTargetIndex !== -1;
  const unreadCount = hasUnreadMessages ? messages.slice(firstUnreadTargetIndex).filter(msg => msg.sender_id === targetUser.id).length : 0;

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#36393f'
    }}>
      {/* DM Header */}
      <div style={{
        height: '48px',
        borderBottom: '1px solid #202225',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        backgroundColor: '#36393f'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
          <div style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#5865F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            marginRight: '8px',
            fontSize: '12px'
          }}>
            {getAvatarInitial(targetUser.username)}
          </div>
          <div>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>
              {targetUser.username}
            </span>
            <div style={{ color: '#43b581', fontSize: '12px' }}>
              Çevrimiçi
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          {unreadCount > 0 && !hasScrolledToBottom && (
            <button
              onClick={scrollToBottom}
              style={{
                backgroundColor: '#f04747',
                border: 'none',
                color: 'white',
                borderRadius: '12px',
                padding: '4px 8px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
            >
              {unreadCount} yeni mesaj
            </button>
          )}
          <button style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#b9bbbe',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '16px'
          }}>
            📞
          </button>
          <button style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#b9bbbe',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '16px'
          }}>
            📹
          </button>
          <button 
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#b9bbbe',
              cursor: 'pointer',
              padding: '4px',
              fontSize: '16px'
            }}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#8e9297'
          }}>
            Mesajlar yükleniyor...
          </div>
        ) : messages.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#5865F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              fontSize: '32px',
              color: 'white'
            }}>
              {getAvatarInitial(targetUser.username)}
            </div>
            <h3 style={{ color: 'white', margin: '0 0 8px 0' }}>
              {targetUser.username}
            </h3>
            <p style={{ color: '#b9bbbe', margin: 0 }}>
              {targetUser.username} ile direkt mesajlaşmanın başlangıcı.
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => {
              const prevMsg = messages[index - 1];
              const showHeader = !prevMsg || 
                prevMsg.sender_id !== msg.sender_id || 
                new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 300000;

              // TEST: 2. mesajda göster
              const showNewMessagesDivider = index === 1;

              return (
                <React.Fragment key={msg.id}>
                  {/* Yeni Mesajlar Çizgisi */}
                  {showNewMessagesDivider && (
                    <div 
                      onClick={() => markAsReadManually()}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        margin: '16px 0',
                        position: 'relative',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{
                        flex: 1,
                        height: '1px',
                        backgroundColor: '#f04747'
                      }}></div>
                      <div style={{
                        backgroundColor: '#f04747',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '8px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        margin: '0 8px',
                        textTransform: 'uppercase'
                      }}>
                        Yeni
                      </div>
                      <div style={{
                        flex: 1,
                        height: '1px',
                        backgroundColor: '#f04747'
                      }}></div>
                    </div>
                  )}

                  {/* Mesaj */}
                  <div 
                    style={{ 
                      display: 'flex', 
                      gap: '16px',
                      marginBottom: showHeader ? '16px' : '4px',
                      opacity: isTemporaryMessage(msg.id) ? 0.7 : 1,
                      position: 'relative',
                      padding: '2px 16px 2px 0',
                      borderRadius: '4px',
                      backgroundColor: hoveredMessageId === msg.id ? 'rgba(79, 84, 92, 0.16)' : 'transparent',
                      transition: 'background-color 0.1s'
                    }}
                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                    onMouseLeave={() => setHoveredMessageId(null)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({
                        visible: true,
                        x: e.clientX,
                        y: e.clientY,
                        messageId: msg.id
                      });
                    }}
                  >
                    <div style={{ width: '40px', flexShrink: 0 }}>
                      {showHeader && (
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: '#5865F2',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: 'bold'
                        }}>
                          {getAvatarInitial(msg.sender.username)}
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                      {showHeader && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: '8px',
                          marginBottom: '4px'
                        }}>
                          <span style={{
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '16px'
                          }}>
                            {msg.sender.username}
                          </span>
                          <span style={{
                            color: '#a3a6aa',
                            fontSize: '12px'
                          }}>
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      )}
                      
                      {/* Mesaj İçeriği veya Düzenleme Modu */}
                      {editingMessageId === msg.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            style={{
                              backgroundColor: '#40444b',
                              color: '#dcddde',
                              border: 'none',
                              borderRadius: '4px',
                              padding: '8px',
                              resize: 'none',
                              minHeight: '40px',
                              fontSize: '16px',
                              fontFamily: 'inherit',
                              outline: 'none'
                            }}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveEdit(msg.id);
                              }
                              if (e.key === 'Escape') {
                                handleCancelEdit();
                              }
                            }}
                          />
                          <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
                            <button
                              onClick={() => handleSaveEdit(msg.id)}
                              style={{
                                backgroundColor: '#5865F2',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                padding: '4px 12px',
                                cursor: 'pointer'
                              }}
                            >
                              Kaydet
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              style={{
                                backgroundColor: 'transparent',
                                color: '#b9bbbe',
                                border: 'none',
                                padding: '4px 12px',
                                cursor: 'pointer'
                              }}
                            >
                              İptal
                            </button>
                            <span style={{ color: '#a3a6aa', alignSelf: 'center' }}>
                              Enter ile kaydet • Escape ile iptal
                            </span>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Yanıtlanan Mesaj Gösterimi */}
                          {msg.reply_to && (
                            <div style={{
                              backgroundColor: '#2f3136',
                              borderLeft: '4px solid #4f545c',
                              borderRadius: '4px',
                              padding: '8px 12px',
                              marginBottom: '8px',
                              opacity: 0.8
                            }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '4px'
                              }}>
                                <div style={{
                                  width: '16px',
                                  height: '16px',
                                  borderRadius: '50%',
                                  backgroundColor: '#5865F2',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: 'white',
                                  fontSize: '8px',
                                  fontWeight: 'bold'
                                }}>
                                  {getAvatarInitial(msg.reply_to.sender.username)}
                                </div>
                                <span style={{
                                  color: '#5865F2',
                                  fontSize: '12px',
                                  fontWeight: 'bold'
                                }}>
                                  {msg.reply_to.sender.username}
                                </span>
                              </div>
                              <div style={{
                                color: '#dcddde',
                                fontSize: '14px',
                                maxHeight: '40px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {msg.reply_to.content.length > 80 
                                  ? msg.reply_to.content.substring(0, 80) + '...'
                                  : msg.reply_to.content
                                }
                              </div>
                            </div>
                          )}

                          <MessageContent 
                            content={msg.content}
                            updated_at={msg.updated_at}
                            onServerSelect={onServerSelect}
                          />

                          {/* Tepkiler - Mesajın altında */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '4px',
                              marginTop: '8px'
                            }}>
                              {Object.entries(msg.reactions).map(([emoji, reaction]) => {
                                const hasUserReacted = reaction.users.includes(currentUser.id);
                                return (
                                  <button
                                    key={emoji}
                                    onClick={() => handleAddReaction(msg.id, emoji)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      padding: '2px 6px',
                                      backgroundColor: hasUserReacted ? '#5865f229' : '#2f313629',
                                      border: `1px solid ${hasUserReacted ? '#5865f2' : '#4f545c'}`,
                                      borderRadius: '12px',
                                      cursor: 'pointer',
                                      fontSize: '12px',
                                      color: hasUserReacted ? '#5865f2' : '#dcddde',
                                      transition: 'all 0.1s'
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!hasUserReacted) {
                                        e.currentTarget.style.backgroundColor = '#4f545c29';
                                        e.currentTarget.style.borderColor = '#72767d';
                                      }
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!hasUserReacted) {
                                        e.currentTarget.style.backgroundColor = '#2f313629';
                                        e.currentTarget.style.borderColor = '#4f545c';
                                      }
                                    }}
                                  >
                                    <span style={{ fontSize: '14px' }}>{emoji}</span>
                                    <span style={{ fontSize: '11px', fontWeight: '500' }}>
                                      {reaction.count}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </>
                      )}

                      {/* Hover İconları - GÜNCELLENMIS */}
                      {hoveredMessageId === msg.id && editingMessageId !== msg.id && (
                        <div style={{
                          position: 'absolute',
                          top: showHeader ? '0' : '-16px',
                          right: '0',
                          backgroundColor: '#36393f',
                          border: '1px solid #202225',
                          borderRadius: '8px',
                          padding: '4px',
                          display: 'flex',
                          gap: '2px',
                          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
                          zIndex: 10
                        }}>
                          <button
                            onClick={() => !isTemporaryMessage(msg.id) && handleAddReaction(msg.id, '👍')}
                            disabled={isTemporaryMessage(msg.id)}
                            style={{
                              width: '32px',
                              height: '32px',
                              backgroundColor: 'transparent',
                              border: 'none',
                              borderRadius: '4px',
                              color: isTemporaryMessage(msg.id) ? '#4f545c' : '#b9bbbe',
                              cursor: isTemporaryMessage(msg.id) ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '16px',
                              opacity: isTemporaryMessage(msg.id) ? 0.5 : 1
                            }}
                            title={isTemporaryMessage(msg.id) ? "Mesaj gönderiliyor..." : "👍 Tepki Ekle"}
                            onMouseEnter={(e) => !isTemporaryMessage(msg.id) && (e.currentTarget.style.backgroundColor = '#4f545c')}
                            onMouseLeave={(e) => !isTemporaryMessage(msg.id) && (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            👍
                          </button>
                          <button
                            onClick={() => !isTemporaryMessage(msg.id) && handleReplyToMessage(msg.id)}
                            disabled={isTemporaryMessage(msg.id)}
                            style={{
                              width: '32px',
                              height: '32px',
                              backgroundColor: 'transparent',
                              border: 'none',
                              borderRadius: '4px',
                              color: isTemporaryMessage(msg.id) ? '#4f545c' : '#b9bbbe',
                              cursor: isTemporaryMessage(msg.id) ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '16px',
                              opacity: isTemporaryMessage(msg.id) ? 0.5 : 1
                            }}
                            title={isTemporaryMessage(msg.id) ? "Mesaj gönderiliyor..." : "Yanıtla"}
                            onMouseEnter={(e) => !isTemporaryMessage(msg.id) && (e.currentTarget.style.backgroundColor = '#4f545c')}
                            onMouseLeave={(e) => !isTemporaryMessage(msg.id) && (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            ↩️
                          </button>
                          {msg.sender_id === currentUser.id && (
                            <button
                              onClick={() => !isTemporaryMessage(msg.id) && handleEditMessage(msg.id)}
                              disabled={isTemporaryMessage(msg.id)}
                              style={{
                                width: '32px',
                                height: '32px',
                                backgroundColor: 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                color: isTemporaryMessage(msg.id) ? '#4f545c' : '#b9bbbe',
                                cursor: isTemporaryMessage(msg.id) ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '16px',
                                opacity: isTemporaryMessage(msg.id) ? 0.5 : 1
                              }}
                              title={isTemporaryMessage(msg.id) ? "Mesaj gönderiliyor..." : "Düzenle"}
                              onMouseEnter={(e) => !isTemporaryMessage(msg.id) && (e.currentTarget.style.backgroundColor = '#4f545c')}
                              onMouseLeave={(e) => !isTemporaryMessage(msg.id) && (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              ✏️
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              if (!isTemporaryMessage(msg.id)) {
                                e.stopPropagation();
                                setContextMenu({
                                  visible: true,
                                  x: e.clientX,
                                  y: e.clientY,
                                  messageId: msg.id
                                });
                              }
                            }}
                            disabled={isTemporaryMessage(msg.id)}
                            style={{
                              width: '32px',
                              height: '32px',
                              backgroundColor: 'transparent',
                              border: 'none',
                              borderRadius: '4px',
                              color: isTemporaryMessage(msg.id) ? '#4f545c' : '#b9bbbe',
                              cursor: isTemporaryMessage(msg.id) ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '16px',
                              opacity: isTemporaryMessage(msg.id) ? 0.5 : 1
                            }}
                            title={isTemporaryMessage(msg.id) ? "Mesaj gönderiliyor..." : "Daha Fazla"}
                            onMouseEnter={(e) => !isTemporaryMessage(msg.id) && (e.currentTarget.style.backgroundColor = '#4f545c')}
                            onMouseLeave={(e) => !isTemporaryMessage(msg.id) && (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            ⋮
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
        
        {/* Context Menu - GÜNCELLENMIS */}
        {contextMenu.visible && (
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              backgroundColor: '#18191c',
              borderRadius: '4px',
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.24)',
              border: '1px solid #2f3136',
              minWidth: '200px',
              zIndex: 1000,
              padding: '6px 0'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              onClick={() => {
                if (contextMenu.messageId && !isTemporaryMessage(contextMenu.messageId)) {
                  handleAddReaction(contextMenu.messageId, '👍');
                }
                setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
              }}
              style={{
                padding: '8px 12px',
                cursor: contextMenu.messageId && isTemporaryMessage(contextMenu.messageId) ? 'not-allowed' : 'pointer',
                color: contextMenu.messageId && isTemporaryMessage(contextMenu.messageId) ? '#4f545c' : '#b9bbbe',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                opacity: contextMenu.messageId && isTemporaryMessage(contextMenu.messageId) ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!(contextMenu.messageId && isTemporaryMessage(contextMenu.messageId))) {
                  e.currentTarget.style.backgroundColor = '#4f545c';
                }
              }}
              onMouseLeave={(e) => {
                if (!(contextMenu.messageId && isTemporaryMessage(contextMenu.messageId))) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '16px' }}>👍</span>
              Beğen
            </div>

            {/* Popüler Tepkiler */}
            <div style={{
              padding: '8px 12px',
              display: 'flex',
              gap: '8px',
              alignItems: 'center'
            }}>
              {['😀', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    if (contextMenu.messageId && !isTemporaryMessage(contextMenu.messageId)) {
                      handleAddReaction(contextMenu.messageId, emoji);
                    }
                    setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
                  }}
                  disabled={contextMenu.messageId ? isTemporaryMessage(contextMenu.messageId) : false}
                  style={{
                    width: '28px',
                    height: '28px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: contextMenu.messageId && isTemporaryMessage(contextMenu.messageId) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    opacity: contextMenu.messageId && isTemporaryMessage(contextMenu.messageId) ? 0.5 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!(contextMenu.messageId && isTemporaryMessage(contextMenu.messageId))) {
                      e.currentTarget.style.backgroundColor = '#4f545c';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(contextMenu.messageId && isTemporaryMessage(contextMenu.messageId))) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <div style={{ height: '1px', backgroundColor: '#2f3136', margin: '4px 0' }}></div>
            
            <div
              onClick={() => {
                if (contextMenu.messageId && !isTemporaryMessage(contextMenu.messageId)) {
                  handleReplyToMessage(contextMenu.messageId);
                }
                setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
              }}
              style={{
                padding: '8px 12px',
                cursor: contextMenu.messageId && isTemporaryMessage(contextMenu.messageId) ? 'not-allowed' : 'pointer',
                color: contextMenu.messageId && isTemporaryMessage(contextMenu.messageId) ? '#4f545c' : '#b9bbbe',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                opacity: contextMenu.messageId && isTemporaryMessage(contextMenu.messageId) ? 0.5 : 1
              }}
              onMouseEnter={(e) => {
                if (!(contextMenu.messageId && isTemporaryMessage(contextMenu.messageId))) {
                  e.currentTarget.style.backgroundColor = '#4f545c';
                }
              }}
              onMouseLeave={(e) => {
                if (!(contextMenu.messageId && isTemporaryMessage(contextMenu.messageId))) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span style={{ fontSize: '16px' }}>↩️</span>
              Yanıtla
            </div>

            {/* Sadece kendi mesajları için düzenleme */}
            {contextMenu.messageId && messages.find(m => m.id === contextMenu.messageId)?.sender_id === currentUser.id && (
              <div
                onClick={() => {
                  if (contextMenu.messageId && !isTemporaryMessage(contextMenu.messageId)) {
                    handleEditMessage(contextMenu.messageId);
                  }
                  setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
                }}
                style={{
                  padding: '8px 12px',
                  cursor: contextMenu.messageId && isTemporaryMessage(contextMenu.messageId) ? 'not-allowed' : 'pointer',
                  color: contextMenu.messageId && isTemporaryMessage(contextMenu.messageId) ? '#4f545c' : '#b9bbbe',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  opacity: contextMenu.messageId && isTemporaryMessage(contextMenu.messageId) ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!(contextMenu.messageId && isTemporaryMessage(contextMenu.messageId))) {
                    e.currentTarget.style.backgroundColor = '#4f545c';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!(contextMenu.messageId && isTemporaryMessage(contextMenu.messageId))) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span style={{ fontSize: '16px' }}>✏️</span>
                Mesajı Düzenle
              </div>
            )}

            <div style={{ height: '1px', backgroundColor: '#2f3136', margin: '4px 0' }}></div>

            <div
              onClick={() => {
                const message = contextMenu.messageId && messages.find(m => m.id === contextMenu.messageId);
                if (message) {
                  handleCopyMessage(message.content);
                }
                setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                color: '#b9bbbe',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f545c'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '16px' }}>📋</span>
              Metni Kopyala
            </div>

            <div
              onClick={() => {
                if (contextMenu.messageId) {
                  handleCopyMessageLink(contextMenu.messageId);
                }
                setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                color: '#b9bbbe',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f545c'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '16px' }}>🔗</span>
              Mesaj Bağlantısını Kopyala
            </div>

            <div
              onClick={() => {
                if (contextMenu.messageId) {
                  handleMarkUnread(contextMenu.messageId);
                }
                setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                color: '#b9bbbe',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f545c'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '16px' }}>📧</span>
              Okunmadı Olarak İşaretle
            </div>

            <div style={{ height: '1px', backgroundColor: '#2f3136', margin: '4px 0' }}></div>

            {/* Sadece kendi mesajları için silme */}
            {contextMenu.messageId && messages.find(m => m.id === contextMenu.messageId)?.sender_id === currentUser.id && (
              <div
                onClick={() => {
                  if (contextMenu.messageId) {
                    handleDeleteMessage(contextMenu.messageId);
                  }
                  setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
                }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  color: '#ed4245',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f545c'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span style={{ fontSize: '16px' }}>🗑️</span>
                Mesajı Sil
              </div>
            )}

            <div
              onClick={() => {
                if (contextMenu.messageId) {
                  navigator.clipboard.writeText(contextMenu.messageId);
                }
                setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
              }}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                color: '#b9bbbe',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f545c'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '16px' }}>🆔</span>
              Mesaj ID'sini Kopyala
            </div>
          </div>
        )}
      </div>

      {/* Okunmamış mesaj scroll butonu */}
      {unreadCount > 0 && !hasScrolledToBottom && (
        <div style={{
          position: 'absolute',
          bottom: '100px',
          right: '20px',
          zIndex: 10
        }}>
          <button
            onClick={scrollToBottom}
            style={{
              backgroundColor: '#5865F2',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
            }}
          >
            ↓
          </button>
        </div>
      )}

      {/* Message Input */}
      <div style={{ padding: '0 16px 24px 16px' }}>
        {/* Yanıt Preview */}
        {replyingToMessage && (
          <div style={{
            backgroundColor: '#2f3136',
            borderRadius: '8px 8px 0 0',
            padding: '8px 12px',
            borderLeft: '4px solid #5865F2',
            marginBottom: '0'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '4px'
            }}>
              <span style={{
                color: '#5865F2',
                fontSize: '12px',
                fontWeight: 'bold'
              }}>
                @{replyingToMessage.sender.username} kullanıcısına yanıt veriyor
              </span>
              <button
                onClick={handleCancelReply}
                style={{
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: '#b9bbbe',
                  cursor: 'pointer',
                  padding: '2px',
                  fontSize: '16px'
                }}
              >
                ✕
              </button>
            </div>
            <div style={{
              color: '#dcddde',
              fontSize: '14px',
              opacity: 0.8,
              maxHeight: '60px',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {replyingToMessage.content.length > 100 
                ? replyingToMessage.content.substring(0, 100) + '...'
                : replyingToMessage.content
              }
            </div>
          </div>
        )}

        <form onSubmit={handleSendMessage}>
          <div style={{
            backgroundColor: '#40444b',
            borderRadius: replyingToMessage ? '0 0 8px 8px' : '8px',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center'
          }}>
            <input
              type="text"
              value={newMessage}
              onChange={handleInputChange}
              placeholder={
                replyingToMessage 
                  ? `@${replyingToMessage.sender.username} kullanıcısına yanıt ver`
                  : `@${targetUser.username} kullanıcısına mesaj gönder`
              }
              disabled={sending}
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#dcddde',
                fontSize: '16px',
                padding: '11px 0',
                fontFamily: 'inherit'
              }}
              maxLength={2000}
            />
            {sending && (
              <div style={{
                color: '#8e9297',
                fontSize: '14px',
                marginLeft: '8px'
              }}>
                Gönderiliyor...
              </div>
            )}
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: '#5865F2',
                cursor: 'pointer',
                padding: '8px',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                opacity: !newMessage.trim() || sending ? 0.5 : 1
              }}
            >
              ➤
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DMChat;