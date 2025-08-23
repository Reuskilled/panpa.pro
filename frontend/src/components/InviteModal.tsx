import React, { useState } from 'react';
import { Server } from '../types';
import { serverApi } from '../services/api';

interface InviteModalProps {
  server: Server;
  onClose: () => void;
}

interface InviteData {
  code: string;
  server_id: string;
  server_name: string;
  invited_by: string;
  expires_at: string;
  url: string;
}

const InviteModal: React.FC<InviteModalProps> = ({ server, onClose }) => {
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const createInvite = async () => {
    setLoading(true);
    try {
      const response = await serverApi.createInvite(server.id);
      setInvite(response.invite);
    } catch (error) {
      console.error('Davet oluşturulamadı:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (invite) {
      try {
        await navigator.clipboard.writeText(invite.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        console.error('Kopyalama başarısız:', error);
      }
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  React.useEffect(() => {
    createInvite();
  }, []);

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={handleBackdropClick}
    >
      <div style={{
        backgroundColor: '#36393f',
        borderRadius: '8px',
        padding: '24px',
        width: '440px',
        maxWidth: '90vw'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{
            color: 'white',
            fontSize: '20px',
            fontWeight: 'bold',
            margin: 0
          }}>
            Arkadaşlarını {server.name} sunucusuna davet et
          </h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: '#b9bbbe',
              cursor: 'pointer',
              fontSize: '20px',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            color: '#b9bbbe'
          }}>
            Davet linki oluşturuluyor...
          </div>
        ) : invite ? (
          <>
            <div style={{ marginBottom: '16px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#b9bbbe',
                fontSize: '12px',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                Sunucu Davet Linki
              </label>
              <div style={{
                display: 'flex',
                backgroundColor: '#2f3136',
                borderRadius: '4px',
                border: '1px solid #202225'
              }}>
                <input
                  type="text"
                  value={invite.url}
                  readOnly
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'white',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
                <button
                  onClick={copyToClipboard}
                  style={{
                    padding: '12px 16px',
                    backgroundColor: copied ? '#43b581' : '#5865F2',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    borderRadius: '0 4px 4px 0'
                  }}
                >
                  {copied ? 'Kopyalandı!' : 'Kopyala'}
                </button>
              </div>
            </div>

            <div style={{
              backgroundColor: '#2f3136',
              borderRadius: '4px',
              padding: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '16px',
                  backgroundColor: '#5865F2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '18px'
                }}>
                  {server.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ color: 'white', fontWeight: 'bold', fontSize: '16px' }}>
                    {server.name}
                  </div>
                  <div style={{ color: '#b9bbbe', fontSize: '14px' }}>
                    {invite.invited_by} tarafından davet edildiniz
                  </div>
                </div>
              </div>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#b9bbbe',
              fontSize: '12px',
              marginBottom: '16px'
            }}>
              <span>⏰</span>
              <span>
                Bu davet {new Date(invite.expires_at).toLocaleString('tr-TR')} tarihinde sona erecek
              </span>
            </div>

            <div style={{
              display: 'flex',
              gap: '8px'
            }}>
              <button
                onClick={copyToClipboard}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#5865F2',
                  border: 'none',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                Linki Kopyala
              </button>
              <button
                onClick={() => createInvite()}
                style={{
                  padding: '12px 16px',
                  backgroundColor: '#4f545c',
                  border: 'none',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Yeni Link
              </button>
            </div>
          </>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px',
            color: '#f04747'
          }}>
            Davet linki oluşturulamadı
          </div>
        )}
      </div>
    </div>
  );
};

export default InviteModal;