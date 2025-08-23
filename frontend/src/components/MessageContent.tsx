import React from 'react';
import LinkPreview from './LinkPreview';
import { Server } from '../types';

interface MessageContentProps {
  content: string;
  updated_at?: string;
  onServerSelect?: (server: Server) => void; // Sunucu seçimi için callback
}

const MessageContent: React.FC<MessageContentProps> = ({ content, updated_at, onServerSelect }) => {
  // URL'leri tespit et
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const urls = content.match(urlRegex) || [];
  
  // Davet linklerini filtrele
  const inviteLinks = urls.filter(url => url.includes('/invite/'));
  
  // URL'leri linklendir
  const renderContentWithLinks = (text: string) => {
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#00b8d4',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  return (
    <div>
      {/* Ana mesaj içeriği */}
      <div style={{
        color: '#dcddde',
        fontSize: '16px',
        lineHeight: '1.375',
        wordWrap: 'break-word'
      }}>
        {renderContentWithLinks(content)}
        {updated_at && (
          <span style={{
            color: '#72767d',
            fontSize: '12px',
            marginLeft: '8px',
            fontStyle: 'italic'
          }}>
            (düzenlendi)
          </span>
        )}
      </div>

      {/* Link önizlemeleri */}
      {inviteLinks.map((url, index) => (
        <LinkPreview 
          key={index} 
          url={url} 
          onServerSelect={onServerSelect}
        />
      ))}
    </div>
  );
};

export default MessageContent;