import React, { useState, useEffect } from 'react';
import { User, Server, Channel } from '../types';
import { serverApi, dmApi } from '../services/api';
import ServerList from '../components/ServerList';
import ChannelList from '../components/ChannelList';
import ChatArea from '../components/ChatArea';
import CreateServerModal from '../components/CreateServerModal';
import DMPanel from '../components/DMPanel';
import DMChat from '../components/DMChat';
import FriendsManagementPanel from '../components/FriendsManagementPanel';

interface MainAppProps {
  user: User;
  onLogout: () => void;
}

type ViewMode = 'dm' | 'server' | 'dm_chat';

const MainApp: React.FC<MainAppProps> = ({ user, onLogout }) => {
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('dm');
  const [dmTarget, setDmTarget] = useState<User | null>(null);
  const [isFromServerList, setIsFromServerList] = useState(false);
  const [selectedDMTab, setSelectedDMTab] = useState<'friends' | 'nitro' | 'shop'>('friends');

  // URL state management
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const dmUserId = urlParams.get('dm');
    const tabParam = urlParams.get('tab');
    
    if (tabParam && ['friends', 'nitro', 'shop'].includes(tabParam)) {
      setSelectedDMTab(tabParam as 'friends' | 'nitro' | 'shop');
    }
    
    if (dmUserId) {
      setViewMode('dm_chat');
    }
  }, []);

  // Sunucuları yükle
  useEffect(() => {
    loadServers();
  }, []);

  // Seçili sunucu değiştiğinde kanalları yükle
  useEffect(() => {
    if (selectedServer && viewMode === 'server') {
      loadChannels(selectedServer.id);
    } else {
      setChannels([]);
      setSelectedChannel(null);
    }
  }, [selectedServer, viewMode]);

  const loadServers = async () => {
    try {
      const response = await serverApi.getAll();
      setServers(response.servers || []);
    } catch (error) {
      console.error('Sunucular yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChannels = async (serverId: string) => {
    try {
      const response = await serverApi.getDetails(serverId);
      setChannels(response.channels || []);
      
      const firstTextChannel = response.channels?.find((c: Channel) => c.type === 'text');
      if (firstTextChannel) {
        setSelectedChannel(firstTextChannel);
      }
    } catch (error) {
      console.error('Kanallar yüklenemedi:', error);
    }
  };

  const handleCreateServer = async (name: string, description?: string) => {
    try {
      const response = await serverApi.create(name, description);
      if (response.server) {
        const newServer = response.server;
        setServers(prev => [...prev, newServer]);
        setSelectedServer(newServer);
        setViewMode('server');
        setShowCreateModal(false);
      }
    } catch (error) {
      console.error('Sunucu oluşturulamadı:', error);
    }
  };

  const handleHomeClick = () => {
    setViewMode('dm');
    setSelectedServer(null);
    setSelectedChannel(null);
    setDmTarget(null);
  };

  const handleServerSelect = (server: Server) => {
    setViewMode('server');
    setSelectedServer(server);
    setDmTarget(null);
  };

  // GÜNCELLENDI: Arkadaşa tıklayınca conversation entry oluşturulur
  const handleStartDM = async (targetUser: User, fromServerList: boolean = false) => {
    console.log('MainApp handleStartDM called with:', targetUser.username);
    
    try {
      // Conversation entry oluştur (mesaj olmadan da conversation listesinde görünsün)
      await dmApi.createConversation(targetUser.id);
      console.log('Conversation entry created for user:', targetUser.id);
    } catch (error) {
      console.warn('Failed to create conversation entry:', error);
    }
    
    // DM moduna geç
    setViewMode('dm_chat');
    setDmTarget(targetUser);
    setSelectedServer(null);
    setSelectedChannel(null);
    setIsFromServerList(fromServerList);
    
    // DMPanel'i yenile (mevcut conversation'ları göster)
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('refreshConversations'));
    }, 100);
  };

  const handleDMTabChange = (tab: 'friends' | 'nitro' | 'shop') => {
    setSelectedDMTab(tab);
  };

  const handleCloseDM = () => {
    setViewMode('dm');
    setDmTarget(null);
  };

  // DM Welcome Screen Component
  const DMWelcomeScreen = () => (
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
          Arkadaşlarınla sohbet et!
        </h1>
        <p style={{ 
          margin: '0 0 32px 0',
          fontSize: '16px',
          lineHeight: '1.375',
          color: '#b9bbbe'
        }}>
          Sol taraftan bir arkadaşını seç ve direkt mesajlaşmaya başla. 
          Yeni arkadaşlar ekleyebilir veya mevcut arkadaşlarınla konuşabilirsin.
        </p>
      </div>
    </div>
  );

  // Nitro Panel Component
  const NitroPanel = () => (
    <div style={{
      flex: 1,
      backgroundColor: '#36393f',
      padding: '40px'
    }}>
      <div style={{ textAlign: 'center', color: 'white', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #ff6b6b, #ff8e8e)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 32px',
          fontSize: '48px'
        }}>
          ⚡
        </div>
        
        <h1 style={{ 
          fontSize: '48px', 
          fontWeight: 'bold', 
          margin: '0 0 16px 0',
          background: 'linear-gradient(135deg, #ff6b6b, #4ecdc4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Discord Nitro
        </h1>
        
        <p style={{ 
          fontSize: '18px', 
          color: '#b9bbbe', 
          margin: '0 0 40px 0',
          lineHeight: '1.5'
        }}>
          Discord deneyimini geliştiren premium abonelik servisi
        </p>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '24px', 
          marginBottom: '40px'
        }}>
          <div style={{ 
            backgroundColor: '#2f3136', 
            padding: '24px', 
            borderRadius: '12px',
            border: '2px solid #404448'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>📁</div>
            <h3 style={{ color: 'white', fontSize: '18px', margin: '0 0 8px 0' }}>
              Büyük Dosya Paylaşımı
            </h3>
            <p style={{ color: '#b9bbbe', fontSize: '14px', margin: 0 }}>
              100MB'a kadar dosya yükle ve paylaş
            </p>
          </div>

          <div style={{ 
            backgroundColor: '#2f3136', 
            padding: '24px', 
            borderRadius: '12px',
            border: '2px solid #404448'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>🎥</div>
            <h3 style={{ color: 'white', fontSize: '18px', margin: '0 0 8px 0' }}>
              HD Video & Ekran Paylaşımı
            </h3>
            <p style={{ color: '#b9bbbe', fontSize: '14px', margin: 0 }}>
              1080p 60fps kalitesinde yayın yap
            </p>
          </div>

          <div style={{ 
            backgroundColor: '#2f3136', 
            padding: '24px', 
            borderRadius: '12px',
            border: '2px solid #404448'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>🎨</div>
            <h3 style={{ color: 'white', fontSize: '18px', margin: '0 0 8px 0' }}>
              Özel Emoji & Sticker
            </h3>
            <p style={{ color: '#b9bbbe', fontSize: '14px', margin: 0 }}>
              Her yerde özel emoji kullan
            </p>
          </div>

          <div style={{ 
            backgroundColor: '#2f3136', 
            padding: '24px', 
            borderRadius: '12px',
            border: '2px solid #404448'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>🌟</div>
            <h3 style={{ color: 'white', fontSize: '18px', margin: '0 0 8px 0' }}>
              Profil Rozetleri
            </h3>
            <p style={{ color: '#b9bbbe', fontSize: '14px', margin: 0 }}>
              Özel rozet ve animasyonlar
            </p>
          </div>
        </div>

        <button style={{
          backgroundColor: '#5865F2',
          color: 'white',
          border: 'none',
          padding: '16px 48px',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4752c4'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5865F2'}
        >
          Nitro'yu Keşfet
        </button>
      </div>
    </div>
  );

  // Shop Panel Component
  const ShopPanel = () => (
    <div style={{
      flex: 1,
      backgroundColor: '#36393f',
      padding: '40px'
    }}>
      <div style={{ textAlign: 'center', color: 'white', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{
          width: '120px',
          height: '120px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #4ecdc4, #44a08d)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 32px',
          fontSize: '48px'
        }}>
          🛍️
        </div>
        
        <h1 style={{ 
          fontSize: '48px', 
          fontWeight: 'bold', 
          margin: '0 0 16px 0',
          background: 'linear-gradient(135deg, #4ecdc4, #44a08d)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          Discord Mağaza
        </h1>
        
        <p style={{ 
          fontSize: '18px', 
          color: '#b9bbbe', 
          margin: '0 0 40px 0',
          lineHeight: '1.5'
        }}>
          Oyunlar, uygulamalar ve daha fazlası için tek adresin
        </p>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr 1fr', 
          gap: '20px', 
          marginBottom: '40px'
        }}>
          {[
            { icon: '🎮', title: 'Oyunlar', desc: 'En yeni oyunları keşfet' },
            { icon: '🎵', title: 'Müzik', desc: 'Favori şarkıların' },
            { icon: '📱', title: 'Uygulamalar', desc: 'Faydalı uygulamalar' },
            { icon: '🎨', title: 'Temalar', desc: 'Discord\'u kişiselleştir' },
            { icon: '🤖', title: 'Botlar', desc: 'Sunucunu güçlendir' },
            { icon: '💎', title: 'Premium', desc: 'Özel içerikler' }
          ].map((item, index) => (
            <div key={index} style={{ 
              backgroundColor: '#2f3136', 
              padding: '20px', 
              borderRadius: '12px',
              border: '2px solid #404448',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#5865F2';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#404448';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
            >
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>{item.icon}</div>
              <h3 style={{ color: 'white', fontSize: '16px', margin: '0 0 8px 0' }}>
                {item.title}
              </h3>
              <p style={{ color: '#b9bbbe', fontSize: '12px', margin: 0 }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        <div style={{
          backgroundColor: '#2f3136',
          padding: '24px',
          borderRadius: '12px',
          border: '2px solid #ffa500',
          marginBottom: '32px'
        }}>
          <h3 style={{ color: '#ffa500', fontSize: '18px', margin: '0 0 8px 0' }}>
            🚧 Yakında Açılıyor!
          </h3>
          <p style={{ color: '#b9bbbe', fontSize: '14px', margin: 0 }}>
            Discord Mağaza henüz test aşamasında. Çok yakında sizlerle!
          </p>
        </div>

        <button style={{
          backgroundColor: '#4ecdc4',
          color: 'white',
          border: 'none',
          padding: '16px 48px',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#44a08d'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4ecdc4'}
        >
          Haberdar Ol
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#2F3136',
        color: 'white'
      }}>
        Sunucular yükleniyor...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#36393f' }}>
      <ServerList
        servers={servers}
        selectedServer={selectedServer}
        onServerSelect={handleServerSelect}
        onCreateServer={() => setShowCreateModal(true)}
        onHomeClick={handleHomeClick}
        viewMode={viewMode === 'server' ? 'server' : 'dm'}
        onStartDM={(user) => handleStartDM(user, true)}
        activeDMUserId={dmTarget?.id}
      />

      {/* DM Mode Layout */}
      {viewMode === 'dm' && (
        <>
          <DMPanel
            user={user}
            onLogout={onLogout}
            onStartDM={handleStartDM}
            onTabChange={handleDMTabChange}
            selectedTab={selectedDMTab}
          />
          {selectedDMTab === 'friends' && (
            <FriendsManagementPanel 
              user={user} 
              onStartDM={handleStartDM} 
            />
          )}
          {selectedDMTab === 'nitro' && <NitroPanel />}
          {selectedDMTab === 'shop' && <ShopPanel />}
        </>
      )}

      {/* DM Chat Mode Layout */}
      {viewMode === 'dm_chat' && dmTarget && (
        <>
          <DMPanel
            user={user}
            onLogout={onLogout}
            onStartDM={handleStartDM}
            onTabChange={handleDMTabChange}
            selectedTab={selectedDMTab}
            activeDMUserId={dmTarget.id}
          />
          <DMChat
            currentUser={user}
            targetUser={dmTarget}
            onClose={handleCloseDM}
            showNewMessageDivider={isFromServerList}
            onServerSelect={handleServerSelect}
          />
        </>
      )}

      {/* Server Mode Layout */}
      {viewMode === 'server' && (
        <>
          <ChannelList
            server={selectedServer}
            channels={channels}
            selectedChannel={selectedChannel}
            onChannelSelect={setSelectedChannel}
            user={user}
            onLogout={onLogout}
          />
          <ChatArea
            channel={selectedChannel}
            server={selectedServer}
            user={user}
            viewMode={viewMode}
          />
        </>
      )}

      {showCreateModal && (
        <CreateServerModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateServer}
        />
      )}
    </div>
  );
};

export default MainApp;