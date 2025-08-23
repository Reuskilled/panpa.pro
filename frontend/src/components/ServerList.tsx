import React from 'react';
import { Server } from '../types';
import { useSocket } from '../contexts/SocketContext';

interface ServerListProps {
  servers: Server[];
  selectedServer: Server | null;
  onServerSelect: (server: Server) => void;
  onCreateServer: () => void;
  onHomeClick: () => void;
  viewMode: 'dm' | 'server';
  onStartDM?: (user: any) => void;
  activeDMUserId?: string; // Aktif DM'deki kullanıcının ID'si
}

const ServerList: React.FC<ServerListProps> = ({
  servers,
  selectedServer,
  onServerSelect,
  onCreateServer,
  onHomeClick,
  viewMode,
  onStartDM,
  activeDMUserId,
}) => {
  const { notifications, unreadCounts, markNotificationAsRead, markConversationAsRead } = useSocket();

  // Aktif DM'deki kullanıcı hariç, okunmamış mesajı olan kullanıcıları getir
  const activeDMUsers = React.useMemo(() => {
    const userMap = new Map();
    
    Object.keys(unreadCounts).forEach(userId => {
      const count = unreadCounts[userId];
      // Sadece okunmamış mesajı olan VE aktif DM'de olmayan kullanıcıları göster
      if (count > 0 && userId !== activeDMUserId) {
        const userNotification = notifications.find(n => n.from.id === userId);
        if (userNotification) {
          userMap.set(userId, {
            user: userNotification.from,
            unreadCount: count,
            lastMessage: userNotification.content,
            timestamp: userNotification.timestamp
          });
        }
      }
    });
    
    return Array.from(userMap.values()).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [unreadCounts, notifications, activeDMUserId]);

  const handleUserClick = (userData: any) => {
    console.log('User clicked:', userData);
    
    // DM başlat
    if (onStartDM) {
      onStartDM(userData.user);
    }
    
    // Okundu olarak işaretle
    markConversationAsRead(userData.user.id);
  };

  return (
    <div style={{
      width: '72px',
      backgroundColor: '#202225',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px 0',
      gap: '8px',
      position: 'relative'
    }}>
      {/* Home Button */}
      <div style={{ position: 'relative' }}>
        <div 
          onClick={onHomeClick}
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: viewMode === 'dm' ? '#5865F2' : '#36393f',
            borderRadius: viewMode === 'dm' ? '16px' : '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '18px'
          }}
          onMouseEnter={(e) => {
            if (viewMode !== 'dm') {
              e.currentTarget.style.borderRadius = '16px';
              e.currentTarget.style.backgroundColor = '#5865F2';
            }
          }}
          onMouseLeave={(e) => {
            if (viewMode !== 'dm') {
              e.currentTarget.style.borderRadius = '50%';
              e.currentTarget.style.backgroundColor = '#36393f';
            }
          }}
        >
          D
        </div>
      </div>

      {/* Separator */}
      <div style={{
        width: '32px',
        height: '2px',
        backgroundColor: '#36393f',
        borderRadius: '1px',
        margin: '4px 0'
      }}></div>

      {/* DM User Avatars - Sadece okunmamış mesajı olan ve aktif olmayan kullanıcılar */}
      {activeDMUsers.map((userData) => (
        <div key={userData.user.id} style={{ position: 'relative' }}>
          <div 
            onClick={() => handleUserClick(userData)}
            style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#36393f',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '16px',
              marginBottom: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderRadius = '16px';
              e.currentTarget.style.backgroundColor = '#5865F2';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderRadius = '50%';
              e.currentTarget.style.backgroundColor = '#36393f';
            }}
          >
            {userData.user.avatar_url ? (
              <img 
                src={userData.user.avatar_url} 
                alt={userData.user.username}
                style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
              />
            ) : (
              userData.user.username.charAt(0).toUpperCase()
            )}
          </div>
          
          {/* Unread Badge - Discord benzeri */}
          <div
            style={{
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
              border: '2px solid #202225',
              padding: '0 4px'
            }}
          >
            {userData.unreadCount > 99 ? '99+' : userData.unreadCount}
          </div>
        </div>
      ))}

      {/* DM Separator - Sadece DM kullanıcıları varsa */}
      {activeDMUsers.length > 0 && (
        <div style={{
          width: '32px',
          height: '2px',
          backgroundColor: '#36393f',
          borderRadius: '1px',
          margin: '4px 0'
        }}></div>
      )}

      {/* Server List */}
      {servers.map((server) => (
        <div
          key={server.id}
          onClick={() => onServerSelect(server)}
          style={{
            width: '48px',
            height: '48px',
            backgroundColor: selectedServer?.id === server.id && viewMode === 'server' ? '#5865F2' : '#36393f',
            borderRadius: selectedServer?.id === server.id && viewMode === 'server' ? '16px' : '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '16px'
          }}
          onMouseEnter={(e) => {
            if (!(selectedServer?.id === server.id && viewMode === 'server')) {
              e.currentTarget.style.borderRadius = '16px';
              e.currentTarget.style.backgroundColor = '#4752c4';
            }
          }}
          onMouseLeave={(e) => {
            if (!(selectedServer?.id === server.id && viewMode === 'server')) {
              e.currentTarget.style.borderRadius = '50%';
              e.currentTarget.style.backgroundColor = '#36393f';
            }
          }}
        >
          {server.icon_url ? (
            <img 
              src={server.icon_url} 
              alt={server.name}
              style={{ width: '100%', height: '100%', borderRadius: 'inherit' }}
            />
          ) : (
            server.name.charAt(0).toUpperCase()
          )}
        </div>
      ))}

      {/* Add Server Button */}
      <div
        onClick={onCreateServer}
        style={{
          width: '48px',
          height: '48px',
          backgroundColor: '#36393f',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          color: '#43b581',
          fontSize: '24px',
          fontWeight: 'bold'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderRadius = '16px';
          e.currentTarget.style.backgroundColor = '#43b581';
          e.currentTarget.style.color = 'white';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderRadius = '50%';
          e.currentTarget.style.backgroundColor = '#36393f';
          e.currentTarget.style.color = '#43b581';
        }}
      >
        +
      </div>
    </div>
  );
};

export default ServerList;