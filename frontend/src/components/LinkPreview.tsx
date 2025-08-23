import React, { useState, useEffect } from 'react';
import { serverApi } from '../services/api';
import { Server } from '../types';

interface LinkPreviewProps {
  url: string;
  onServerSelect?: (server: Server) => void; // Sunucuya yönlendirme için callback
}

interface ServerPreview {
  id: string;
  name: string;
  description?: string;
  icon_url?: string;
  member_count?: number;
  online_count?: number;
  invite_code: string;
}

const LinkPreview: React.FC<LinkPreviewProps> = ({ url, onServerSelect }) => {
  const [preview, setPreview] = useState<ServerPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [userServers, setUserServers] = useState<Server[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // URL'den invite kodu çıkar
  const extractInviteCode = (url: string) => {
    const match = url.match(/\/invite\/([A-Z0-9]+)$/i);
    return match ? match[1] : null;
  };

  // Kullanıcının sunucularını yükle
  const loadUserServers = async () => {
    try {
      const response = await serverApi.getAll();
      setUserServers(response.servers || []);
    } catch (error) {
      console.error('Failed to load user servers:', error);
    }
  };

  useEffect(() => {
    const inviteCode = extractInviteCode(url);
    if (inviteCode) {
      // Davet bilgilerini getir
      fetch(`http://localhost:3001/servers/invite/${inviteCode}/preview`)
        .then(res => res.json())
        .then(data => {
          if (data.server) {
            setPreview(data.server);
          } else {
            setError(true);
          }
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));

      // Kullanıcının sunucularını yükle
      loadUserServers();
    } else {
      setError(true);
      setLoading(false);
    }
  }, [url]);

  // Kullanıcının bu sunucuda üye olup olmadığını kontrol et
  useEffect(() => {
    if (preview && userServers.length > 0) {
      const isUserMember = userServers.some(server => server.id === preview.id);
      setIsMember(isUserMember);
    }
  }, [preview, userServers]);

  const handleJoinServer = async () => {
    if (preview) {
      setActionLoading(true);
      try {
        await serverApi.joinByInvite(preview.invite_code);
        // Sunucu listesini güncelle
        await loadUserServers();
        // Sayfayı yenile veya sunucu listesini güncelle
        window.location.reload();
      } catch (error) {
        console.error('Sunucuya katılma hatası:', error);
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleGoToServer = () => {
    if (preview && onServerSelect) {
      // Kullanıcının sunucularından bu sunucuyu bul
      const server = userServers.find(s => s.id === preview.id);
      if (server) {
        onServerSelect(server);
      }
    }
  };

  if (loading) {
    return (
      <div style={{
        backgroundColor: '#2f3136',
        borderRadius: '8px',
        border: '1px solid #202225',
        padding: '16px',
        marginTop: '8px',
        maxWidth: '432px'
      }}>
        <div style={{ color: '#b9bbbe', fontSize: '14px' }}>
          Davet yükleniyor...
        </div>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div style={{
        backgroundColor: '#2f3136',
        borderRadius: '8px',
        border: '1px solid #202225',
        padding: '16px',
        marginTop: '8px',
        maxWidth: '432px'
      }}>
        <div style={{ color: '#f04747', fontSize: '14px' }}>
          Geçersiz davet linki
        </div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: '#2f3136',
      borderRadius: '8px',
      border: '1px solid #202225',
      padding: '16px',
      marginTop: '8px',
      maxWidth: '432px'
    }}>
      {/* Başlık */}
      <div style={{
        color: isMember ? '#43b581' : '#00b8d4',
        fontSize: '12px',
        fontWeight: 'bold',
        marginBottom: '8px',
        textTransform: 'uppercase'
      }}>
        {isMember ? 'Zaten Üye Olduğun Sunucu' : 'Sunucu Davetini Aldın'}
      </div>

      {/* Sunucu Bilgileri */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginBottom: '16px'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '16px',
          backgroundColor: '#5865F2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '20px',
          backgroundImage: preview.icon_url ? `url(${preview.icon_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}>
          {!preview.icon_url && preview.name.charAt(0).toUpperCase()}
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            color: 'white',
            fontSize: '20px',
            fontWeight: 'bold',
            marginBottom: '4px'
          }}>
            {preview.name}
          </div>
          
          {preview.description && (
            <div style={{
              color: '#b9bbbe',
              fontSize: '14px',
              marginBottom: '8px'
            }}>
              {preview.description}
            </div>
          )}

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            color: '#b9bbbe',
            fontSize: '14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#43b581'
              }}></div>
              <span>{preview.online_count || Math.floor(Math.random() * 50) + 10} Çevrimiçi</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#747f8d'
              }}></div>
              <span>{preview.member_count || Math.floor(Math.random() * 200) + 50} Üye</span>
            </div>
          </div>
        </div>
      </div>

      {/* Aksiyon Butonu */}
      {isMember ? (
        <button
          onClick={handleGoToServer}
          disabled={actionLoading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: actionLoading ? '#3ca374' : '#43b581',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: actionLoading ? 'not-allowed' : 'pointer'
          }}
          onMouseEnter={(e) => {
            if (!actionLoading) {
              e.currentTarget.style.backgroundColor = '#3ca374';
            }
          }}
          onMouseLeave={(e) => {
            if (!actionLoading) {
              e.currentTarget.style.backgroundColor = '#43b581';
            }
          }}
        >
          {actionLoading ? 'Yönlendiriliyor...' : 'Sunucuya Git'}
        </button>
      ) : (
        <button
          onClick={handleJoinServer}
          disabled={actionLoading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: actionLoading ? '#3ca374' : '#43b581',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: actionLoading ? 'not-allowed' : 'pointer'
          }}
          onMouseEnter={(e) => {
            if (!actionLoading) {
              e.currentTarget.style.backgroundColor = '#3ca374';
            }
          }}
          onMouseLeave={(e) => {
            if (!actionLoading) {
              e.currentTarget.style.backgroundColor = '#43b581';
            }
          }}
        >
          {actionLoading ? 'Katılınıyor...' : 'Sunucuya Katıl'}
        </button>
      )}
    </div>
  );
};

export default LinkPreview;