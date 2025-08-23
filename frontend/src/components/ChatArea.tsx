import React, { useState } from 'react';
import { Channel, Server, User, Message } from '../types';

interface ChatAreaProps {
  channel: Channel | null;
  server: Server | null;
  user: User;
  viewMode: 'dm' | 'server';
}

// Geçici mock mesajlar
const mockMessages: Message[] = [
  {
    id: '1',
    channel_id: '1',
    user_id: '1',
    username: 'Alice',
    content: 'Merhaba herkese!',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '2',
    channel_id: '1',
    user_id: '2',
    username: 'Bob',
    content: 'Nasıl gidiyor bugün?',
    created_at: new Date(Date.now() - 3000000).toISOString(),
  },
  {
    id: '3',
    channel_id: '1',
    user_id: '1',
    username: 'Alice',
    content: 'Çok iyi, yeni projem bitti!',
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
];

const ChatArea: React.FC<ChatAreaProps> = ({ channel, server, user, viewMode }) => {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>(mockMessages);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      channel_id: channel?.id || 'dm',
      user_id: user.id,
      username: user.username,
      content: message.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, newMessage]);
    setMessage('');
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // DM görünümü için
  if (viewMode === 'dm') {
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
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '8px', color: '#43b581', fontSize: '20px' }}>@</span>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>
              Arkadaşlar
            </span>
          </div>
        </div>

        {/* Welcome Content */}
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#36393f',
          color: '#8e9297'
        }}>
          <div style={{ textAlign: 'center', maxWidth: '440px', padding: '0 16px' }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              backgroundColor: '#5865F2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              fontSize: '32px',
              color: 'white'
            }}>
              {user.username.charAt(0).toUpperCase()}
            </div>
            <h1 style={{ 
              margin: '0 0 8px 0', 
              color: '#f2f3f5',
              fontSize: '32px',
              fontWeight: 'bold'
            }}>
              Wumpus'a merhaba de!
            </h1>
            <p style={{ 
              margin: '0 0 32px 0',
              fontSize: '16px',
              lineHeight: '1.375',
              color: '#b9bbbe'
            }}>
              Discord klonuna hoş geldin! Arkadaşlarınla sohbet etmeye başlamak için 
              sol taraftaki sunucu listesinden bir sunucu seç veya yeni bir sunucu oluştur.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Channel seçilmemişse
  if (!channel) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#36393f',
        color: '#8e9297'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 8px 0', color: '#dcddde' }}>Kanal seçilmedi</h2>
          <p style={{ margin: 0 }}>Sol taraftan bir kanal seçin</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#36393f'
    }}>
      {/* Channel Header */}
      <div style={{
        height: '48px',
        borderBottom: '1px solid #202225',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        backgroundColor: '#36393f'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ marginRight: '8px', color: '#8e9297', fontSize: '20px' }}>#</span>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>
            {channel.name}
          </span>
        </div>
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '16px' }}>
          <button style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#b9bbbe',
            cursor: 'pointer',
            padding: '4px'
          }}>
            📌
          </button>
          <button style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#b9bbbe',
            cursor: 'pointer',
            padding: '4px'
          }}>
            👥
          </button>
          <button style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: '#b9bbbe',
            cursor: 'pointer',
            padding: '4px'
          }}>
            📥
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {messages
          .filter(msg => msg.channel_id === channel.id)
          .map((msg, index, filteredMessages) => {
            const prevMsg = filteredMessages[index - 1];
            const showHeader = !prevMsg || 
              prevMsg.user_id !== msg.user_id || 
              new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() > 300000;

            return (
              <div key={msg.id} style={{ display: 'flex', gap: '16px' }}>
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
                      {(msg.username || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
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
                        {msg.username}
                      </span>
                      <span style={{
                        color: '#a3a6aa',
                        fontSize: '12px'
                      }}>
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  )}
                  <div style={{
                    color: '#dcddde',
                    fontSize: '16px',
                    lineHeight: '1.375',
                    wordWrap: 'break-word'
                  }}>
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {/* Message Input */}
      <div style={{ padding: '0 16px 24px 16px' }}>
        <form onSubmit={handleSendMessage}>
          <div style={{
            backgroundColor: '#40444b',
            borderRadius: '8px',
            padding: '0 16px'
          }}>
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`#${channel.name} kanalına mesaj gönder`}
              style={{
                width: '100%',
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
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChatArea;