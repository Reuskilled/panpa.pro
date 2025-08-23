import React, { useState } from 'react';
import { Server, Channel, User } from '../types';
import InviteModal from './InviteModal';

interface ChannelListProps {
  server: Server | null;
  channels: Channel[];
  selectedChannel: Channel | null;
  onChannelSelect: (channel: Channel) => void;
  user: User;
  onLogout: () => void;
}

const ChannelList: React.FC<ChannelListProps> = ({
  server,
  channels,
  selectedChannel,
  onChannelSelect,
  user,
  onLogout,
}) => {
  const [showServerMenu, setShowServerMenu] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const textChannels = channels.filter(c => c.type === 'text');
  const voiceChannels = channels.filter(c => c.type === 'voice');

  // Dropdown menüyü kapatmak için
  React.useEffect(() => {
    const handleClickOutside = () => {
      setShowServerMenu(false);
    };

    if (showServerMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showServerMenu]);

  const handleServerMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowServerMenu(!showServerMenu);
  };

  const handleInviteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowInviteModal(true);
    setShowServerMenu(false);
  };

  return (
    <div style={{
      width: '240px',
      backgroundColor: '#2f3136',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh'
    }}>
      {/* Server Header */}
      <div 
        style={{
          height: '48px',
          borderBottom: '1px solid #202225',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          cursor: 'pointer',
          color: 'white',
          fontWeight: 'bold',
          position: 'relative'
        }}
        onClick={handleServerMenuClick}
      >
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {server?.name || 'Sunucu seçin'}
        </span>
        <span style={{ fontSize: '12px', transform: showServerMenu ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
          ▼
        </span>
        
        {/* Server Dropdown Menu */}
        {showServerMenu && server && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '8px',
            right: '8px',
            backgroundColor: '#18191c',
            borderRadius: '4px',
            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.24)',
            border: '1px solid #2f3136',
            zIndex: 1000,
            padding: '6px 0'
          }}>
            <div
              onClick={handleInviteClick}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                color: '#5865F2',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f545c'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <span style={{ fontSize: '16px' }}>👥</span>
              İnsanları Davet Et
            </div>
            
            <div style={{ height: '1px', backgroundColor: '#2f3136', margin: '4px 0' }}></div>
            
            {server.is_owner && (
              <div 
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
                <span style={{ fontSize: '16px' }}>⚙️</span>
                Sunucu Ayarları
              </div>
            )}
            
            <div style={{ height: '1px', backgroundColor: '#2f3136', margin: '4px 0' }}></div>
            
            <div 
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
              <span style={{ fontSize: '16px' }}>🚪</span>
              Sunucudan Ayrıl
            </div>
          </div>
        )}
      </div>

      {/* Channels */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 8px' }}>
        {/* Text Channels */}
        {textChannels.length > 0 && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 8px',
              marginBottom: '4px',
              color: '#8e9297',
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              Text Channels
              <span style={{ cursor: 'pointer' }}>+</span>
            </div>
            {textChannels.map((channel) => (
              <div
                key={channel.id}
                onClick={() => onChannelSelect(channel)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 8px',
                  margin: '1px 0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: selectedChannel?.id === channel.id ? 'white' : '#8e9297',
                  backgroundColor: selectedChannel?.id === channel.id ? '#393c43' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (selectedChannel?.id !== channel.id) {
                    e.currentTarget.style.backgroundColor = '#34373c';
                    e.currentTarget.style.color = '#dcddde';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedChannel?.id !== channel.id) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#8e9297';
                  }
                }}
              >
                <span style={{ marginRight: '6px' }}>#</span>
                <span style={{ fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {channel.name}
                </span>
              </div>
            ))}
          </>
        )}

        {/* Voice Channels */}
        {voiceChannels.length > 0 && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 8px',
              marginTop: '16px',
              marginBottom: '4px',
              color: '#8e9297',
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              Voice Channels
              <span style={{ cursor: 'pointer' }}>+</span>
            </div>
            {voiceChannels.map((channel) => (
              <div
                key={channel.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 8px',
                  margin: '1px 0',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#8e9297'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#34373c';
                  e.currentTarget.style.color = '#dcddde';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#8e9297';
                }}
              >
                <span style={{ marginRight: '6px' }}>🔊</span>
                <span style={{ fontSize: '16px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {channel.name}
                </span>
              </div>
            ))}
          </>
        )}

        {/* No Channels */}
        {channels.length === 0 && (
          <div style={{
            color: '#8e9297',
            textAlign: 'center',
            padding: '32px 16px',
            fontSize: '14px'
          }}>
            Henüz kanal yok
          </div>
        )}
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

      {/* Invite Modal */}
      {showInviteModal && server && (
        <InviteModal
          server={server}
          onClose={() => setShowInviteModal(false)}
        />
      )}
    </div>
  );
};

export default ChannelList;