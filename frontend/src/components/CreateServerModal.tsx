import React, { useState } from 'react';

interface CreateServerModalProps {
  onClose: () => void;
  onCreate: (name: string, description?: string) => void;
}

const CreateServerModal: React.FC<CreateServerModalProps> = ({ onClose, onCreate }) => {
  const [serverName, setServerName] = useState('');
  const [serverDescription, setServerDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!serverName.trim()) return;
    
    setLoading(true);
    try {
      await onCreate(serverName.trim(), serverDescription.trim() || undefined);
    } catch (error) {
      console.error('Sunucu oluşturulamadı:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

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
        padding: '32px',
        width: '440px',
        maxWidth: '90vw'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h2 style={{
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold',
            margin: '0 0 8px 0'
          }}>
            Sunucu oluştur
          </h2>
          <p style={{
            color: '#b9bbbe',
            fontSize: '16px',
            margin: 0,
            lineHeight: '1.375'
          }}>
            Sunucun sen ve arkadaşlarının takıldığı yer. Kendininkini yap ve konuşmaya başla.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#b9bbbe',
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              Sunucu Adı
            </label>
            <input
              type="text"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="Yeni sunucu"
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#202225',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                fontSize: '16px',
                outline: 'none'
              }}
              maxLength={100}
              autoFocus
              required
            />
            <div style={{
              color: '#a3a6aa',
              fontSize: '12px',
              marginTop: '4px'
            }}>
              {serverName.length}/100
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#b9bbbe',
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              Sunucu Açıklaması (isteğe bağlı)
            </label>
            <textarea
              value={serverDescription}
              onChange={(e) => setServerDescription(e.target.value)}
              placeholder="Sunucunun ne hakkında olduğunu anlat"
              style={{
                width: '100%',
                padding: '10px 12px',
                backgroundColor: '#202225',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                fontSize: '16px',
                outline: 'none',
                resize: 'none',
                minHeight: '80px'
              }}
              maxLength={500}
            />
            <div style={{
              color: '#a3a6aa',
              fontSize: '12px',
              marginTop: '4px'
            }}>
              {serverDescription.length}/500
            </div>
          </div>

          <div style={{
            color: '#a3a6aa',
            fontSize: '12px',
            marginBottom: '24px'
          }}>
            Sunucu oluşturarak Discord'un Topluluk Kurallarını kabul etmiş olursun.
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'white',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                padding: '8px 0'
              }}
            >
              Geri
            </button>
            <button
              type="submit"
              disabled={!serverName.trim() || loading}
              style={{
                backgroundColor: loading || !serverName.trim() ? '#4752c4' : '#5865F2',
                border: 'none',
                color: 'white',
                borderRadius: '3px',
                padding: '12px 24px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: loading || !serverName.trim() ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateServerModal;