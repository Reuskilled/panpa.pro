import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { dmApi } from '../services/api';
import { useSocket } from '../contexts/SocketContext'; // YENİ: Socket context eklendi

interface DMPanelProps {
  user: User;
  onLogout: () => void;
  onStartDM?: (friend: User) => void;
  onTabChange?: (tab: 'friends' | 'nitro' | 'shop') => void;
  selectedTab?: 'friends' | 'nitro' | 'shop';
  activeDMUserId?: string;
}

interface DMConversation {
  other_user: User;
  lastMessage: {
    id: string;
    content: string;
    created_at: string;
    sender_id: string;
  };
  hasUnread: boolean;
}

const DMPanel: React.FC<DMPanelProps> = ({ 
  user, 
  onLogout, 
  onStartDM, 
  onTabChange, 
  selectedTab = 'friends',
  activeDMUserId 
}) => {
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // YENİ: Socket context'inden unread counts'ları al
  const { unreadCounts } = useSocket();

  // Conversation'ları backend'den yükle (gizlenmiş olanlar zaten filtrelenmiş gelir)
  const loadConversations = async () => {
    try {
      setLoading(true);
      console.log('DMPanel: Loading conversations from backend...');
      const response = await dmApi.getConversations();
      
      console.log('DMPanel: Backend response:', response);
      console.log('DMPanel: Loaded conversations count:', response.conversations?.length || 0);
      setConversations(response.conversations || []);
    } catch (error) {
      console.error('DMPanel: Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };



  // Conversation gösterme fonksiyonu - Backend API kullanır
  const unhideConversation = async (userId: string) => {
    try {
      console.log('DMPanel: Unhiding conversation for user:', userId);
      
      // Backend API'den göster
      await dmApi.unhideConversation(userId);
      
      // Conversation'ları yeniden yükle
      await loadConversations();
      
      console.log('Conversation başarıyla gösterildi:', userId);
    } catch (error) {
      console.error('Conversation gösterilirken hata:', error);
    }
  };

  // Component mount olduğunda conversation'ları yükle
  useEffect(() => {
    console.log('DMPanel: Component mounted, loading conversations...');
    loadConversations();
  }, []);

  // activeDMUserId değiştiğinde o conversation'ı unhide et
  useEffect(() => {
    if (activeDMUserId) {
      console.log('DMPanel: Active DM user changed to:', activeDMUserId);
      // Eğer o kullanıcı gizlenmişse, conversation'ı geri getir
      unhideConversation(activeDMUserId);
    }
  }, [activeDMUserId]);

  // Yeniden yükleme eventi dinle (MainApp'ten gelen)
  useEffect(() => {
    const handleRefreshConversations = () => {
      console.log('DMPanel: Refresh conversations event received');
      loadConversations();
    };

    // Event listener ekle
    window.addEventListener('refreshConversations', handleRefreshConversations);
    
    // Cleanup
    return () => {
      window.removeEventListener('refreshConversations', handleRefreshConversations);
    };
  }, []);

  // Yeni mesaj geldiğinde conversation'ları güncelle
  useEffect(() => {
    const handleNewMessage = (event: any) => {
      console.log('DMPanel: New message detected, refreshing conversations...');
      
      // Yeni mesaj geldiğinde conversation'ları yenile
      loadConversations();
    };

    // DM mesajı geldiğinde conversation'ları yenile
    window.addEventListener('new_dm_message', handleNewMessage);
    
    return () => {
      window.removeEventListener('new_dm_message', handleNewMessage);
    };
  }, []);

  // Conversation tıklama fonksiyonu
  const handleConversationClick = (conversation: DMConversation) => {
    console.log('DMPanel: Conversation clicked:', conversation.other_user?.username || 'Bilinmeyen Kullanıcı');
    console.log('DMPanel: onStartDM function available:', !!onStartDM);
    
    if (onStartDM) {
      console.log('DMPanel: Calling onStartDM with user:', conversation.other_user);
      onStartDM(conversation.other_user);
    } else {
      console.error('DMPanel: onStartDM function is not available!');
    }
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
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (date.toDateString() === yesterday.toDateString()) {
        return 'Dün';
      } else {
        return date.toLocaleDateString('tr-TR', { 
          day: '2-digit',
          month: '2-digit'
        });
      }
    }
  };

  // YENİ: Conversation'ları okunmamış durumuna göre sırala
  const getSortedConversations = () => {
    return conversations
      .filter(conv => {
        const username = conv.other_user?.username;
        if (!username || !searchQuery) return true;
        return username.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .sort((a, b) => {
        // Önce okunmamış durumuna göre sırala
        const aUnreadCount = unreadCounts[a.other_user.id] || 0;
        const bUnreadCount = unreadCounts[b.other_user.id] || 0;
        
        // Okunmamış mesajı olanları en üste koy
        if (aUnreadCount > 0 && bUnreadCount === 0) return -1;
        if (aUnreadCount === 0 && bUnreadCount > 0) return 1;
        
        // Sonra son mesaj zamanına göre sırala
        const aTime = new Date(a.lastMessage.created_at).getTime();
        const bTime = new Date(b.lastMessage.created_at).getTime();
        return bTime - aTime;
      });
  };

  const filteredConversations = getSortedConversations();

  const renderDirectMessagesList = () => {
    console.log('DMPanel: Rendering DM list. Loading:', loading, 'Conversations:', filteredConversations.length);
    
    if (loading && conversations.length === 0) {
      return (
        <div style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: '#b9bbbe'
        }}>
          Konuşmalar yükleniyor...
        </div>
      );
    }

    if (filteredConversations.length === 0) {
      return (
        <div style={{
          padding: '32px 16px',
          textAlign: 'center',
          color: '#b9bbbe'
        }}>
          {searchQuery ? 'Konuşma bulunamadı' : 'Henüz konuşma yok'}
          <div style={{ fontSize: '12px', marginTop: '8px', color: '#72767d' }}>
            Arkadaşlar sekmesinden birini seç ve konuşmaya başla!
          </div>
        </div>
      );
    }

    return (
      <>
        <div style={{
          color: '#b9bbbe',
          fontSize: '12px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          padding: '8px 16px',
          marginBottom: '8px'
        }}>
          Direkt Mesajlar ({filteredConversations.length})
        </div>

        {filteredConversations.map((conversation) => {
          const isActive = activeDMUserId === conversation.other_user.id;
          const unreadCount = unreadCounts[conversation.other_user.id] || 0;
          const hasUnread = unreadCount > 0;
          
          return (
            <div
              key={conversation.other_user.id}
              onClick={() => handleConversationClick(conversation)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                margin: '2px 8px',
                backgroundColor: isActive ? '#393c43' : 'transparent',
                color: isActive ? 'white' : (hasUnread ? 'white' : '#8e9297'), // YENİ: Okunmamış varsa beyaz
                position: 'relative',
                fontWeight: hasUnread ? 'bold' : 'normal' // YENİ: Okunmamış varsa kalın
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = '#34373c';
                  e.currentTarget.style.color = '#dcddde';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = hasUnread ? 'white' : '#8e9297';
                }
              }}
              className="conversation-item"
            >
              <div style={{ position: 'relative', marginRight: '12px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#5865F2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  // YENİ: Okunmamış varsa border ekle
                  border: hasUnread ? '2px solid #5865F2' : 'none'
                }}>
                  {conversation.other_user?.username?.charAt(0)?.toUpperCase() || '?'}
                </div>
                
                {/* Online indicator */}
                <div style={{
                  position: 'absolute',
                  bottom: '-2px',
                  right: '-2px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: Math.random() > 0.5 ? '#43b581' : '#747f8d',
                  border: '2px solid #2f3136'
                }}></div>

                {/* YENİ: Okunmamış mesaj badge */}
                {hasUnread && (
                  <div style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    minWidth: '16px',
                    height: '16px',
                    backgroundColor: '#f04747',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    border: '2px solid #2f3136',
                    padding: '0 4px'
                  }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </div>
                )}
              </div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: isActive ? 'bold' : (hasUnread ? 'bold' : 'normal'), // YENİ: Okunmamış varsa kalın
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginBottom: '2px'
                }}>
                  {conversation.other_user?.username || 'Bilinmeyen Kullanıcı'}
                </div>
                
                <div style={{
                  fontSize: '12px',
                  color: hasUnread ? '#dcddde' : '#a3a6aa', // YENİ: Okunmamış varsa daha parlak
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: hasUnread ? 'bold' : 'normal' // YENİ: Okunmamış varsa kalın
                }}>
                  {conversation.lastMessage.sender_id === user.id ? 'Sen: ' : ''}
                  {conversation.lastMessage.content.length > 30 
                    ? conversation.lastMessage.content.substring(0, 30) + '...'
                    : conversation.lastMessage.content
                  }
                </div>
              </div>

              <div style={{
                fontSize: '11px',
                color: hasUnread ? '#dcddde' : '#a3a6aa', // YENİ: Okunmamış varsa daha parlak
                marginLeft: '8px',
                fontWeight: hasUnread ? 'bold' : 'normal' // YENİ: Okunmamış varsa kalın
              }}>
                {formatTime(conversation.lastMessage.created_at)}
              </div>


            </div>
          );
        })}

        <style>
          {`
            .conversation-item:hover .dm-close-button {
              opacity: 1 !important;
            }
          `}
        </style>
      </>
    );
  };

  // Component debug logları
  console.log('DMPanel render:', {
    conversationsCount: conversations.length,
    selectedTab,
    activeDMUserId,
    onStartDMAvailable: !!onStartDM,
    loading,
    unreadCounts // YENİ: Debug için
  });

  return (
    <div style={{
      width: '240px',
      backgroundColor: '#2f3136',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh'
    }}>
      {/* Header */}
      <div style={{
        height: '48px',
        borderBottom: '1px solid #202225',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px'
      }}>
        <input
          type="text"
          placeholder="Konuşma ara"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            backgroundColor: '#202225',
            border: 'none',
            borderRadius: '4px',
            padding: '4px 8px',
            color: 'white',
            fontSize: '14px',
            outline: 'none'
          }}
        />
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid #202225',
        backgroundColor: '#2f3136'
      }}>
        {[
          { key: 'friends', label: 'Arkadaşlar' },
          { key: 'nitro', label: 'Nitro' },
          { key: 'shop', label: 'Mağaza' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              console.log('DMPanel: Tab changed to:', tab.key);
              onTabChange && onTabChange(tab.key as any);
            }}
            style={{
              flex: 1,
              padding: '12px 8px',
              backgroundColor: 'transparent',
              border: 'none',
              color: selectedTab === tab.key ? 'white' : '#b9bbbe',
              borderBottom: selectedTab === tab.key ? '2px solid #5865F2' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: selectedTab === tab.key ? 'bold' : 'normal',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Manual Refresh Button - DEV MODE */}
      <div style={{
        padding: '8px 16px',
        borderBottom: '1px solid #202225'
      }}>
        <button
          onClick={() => {
            console.log('Manual refresh triggered');
            loadConversations();
          }}
          style={{
            width: '100%',
            padding: '6px 12px',
            backgroundColor: '#5865F2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px'
          }}
        >
          Konuşmaları Yenile
        </button>
      </div>

      {/* Direct Messages List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {renderDirectMessagesList()}
      </div>

      {/* User Panel */}
      <div style={{
        height: '52px',
        backgroundColor: '#292b2f',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#5865F2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            marginRight: '8px'
          }}>
            {user.username.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {user.username}
            </div>
            <div style={{ color: '#b9bbbe', fontSize: '12px' }}>Çevrimiçi</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button style={{
            width: '32px',
            height: '32px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '4px',
            color: '#b9bbbe',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            🎤
          </button>
          <button style={{
            width: '32px',
            height: '32px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '4px',
            color: '#b9bbbe',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            🎧
          </button>
          <button 
            onClick={onLogout}
            style={{
              width: '32px',
              height: '32px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: '#b9bbbe',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Çıkış Yap"
          >
            ⚙️
          </button>
        </div>
      </div>
    </div>
  );
};

export default DMPanel;