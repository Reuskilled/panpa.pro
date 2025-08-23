import React, { useState, useEffect } from 'react';
import { User, FriendWithUser, FriendRequestWithUser } from '../types';
import { friendsApi } from '../services/api';

interface FriendsManagementPanelProps {
  user: User;
  onStartDM?: (friend: User) => void;
}

interface SearchResult {
  id: string;
  username: string;
  avatar_url?: string;
  is_friend: boolean;
  is_blocked: boolean;
  has_pending_request: boolean;
  has_received_request: boolean;
}

const FriendsManagementPanel: React.FC<FriendsManagementPanelProps> = ({ user, onStartDM }) => {
  const [friendsFilter, setFriendsFilter] = useState<'all' | 'online' | 'pending' | 'blocked'>('all');
  const [friends, setFriends] = useState<FriendWithUser[]>([]);
  const [friendRequests, setFriendRequests] = useState<{ received: FriendRequestWithUser[]; sent: FriendRequestWithUser[]; }>({ received: [], sent: [] });
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadFriends();
    loadFriendRequests();
    if (friendsFilter === 'blocked') {
      loadBlockedUsers();
    }
  }, [friendsFilter]);

  const loadFriends = async () => {
    try {
      const response = await friendsApi.getFriends();
      console.log('Loaded friends:', response.friends?.length); // Debug log
      setFriends(response.friends || []);
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  };

  const loadFriendRequests = async () => {
    try {
      const response = await friendsApi.getFriendRequests();
      setFriendRequests(response);
    } catch (error) {
      console.error('Failed to load friend requests:', error);
    }
  };

  const loadBlockedUsers = async () => {
    try {
      const response = await friendsApi.getBlockedUsers();
      setBlockedUsers(response.blocked || []);
    } catch (error) {
      console.error('Failed to load blocked users:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      const response = await friendsApi.searchUsers(searchQuery.trim());
      setSearchResults(response.users || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (userId: string) => {
    try {
      await friendsApi.sendFriendRequest(userId);
      handleSearch();
    } catch (error) {
      console.error('Failed to send friend request:', error);
    }
  };

  const handleFriendRequest = async (requestId: string, action: 'accept' | 'reject') => {
    try {
      await friendsApi.handleFriendRequest(requestId, action);
      loadFriendRequests();
      if (action === 'accept') {
        loadFriends();
      }
    } catch (error) {
      console.error('Failed to handle friend request:', error);
    }
  };

  // Arkadaş tıklama fonksiyonu - DÜZELTILDI
  const handleFriendClick = (friend: User) => {
    console.log('Friend clicked:', friend); // Debug log
    if (onStartDM) {
      console.log('Calling onStartDM with friend:', friend.username); // Debug log
      onStartDM(friend);
    } else {
      console.log('onStartDM is not available'); // Debug log
    }
  };

  const getStatusColor = (status: 'online' | 'idle' | 'dnd' | 'offline') => {
    switch (status) {
      case 'online': return '#43b581';
      case 'idle': return '#faa61a';
      case 'dnd': return '#f04747';
      case 'offline': return '#747f8d';
      default: return '#747f8d';
    }
  };

  const renderFriendsList = () => {
    let displayList: any[] = [];
    let title = '';

    switch (friendsFilter) {
      case 'all':
        displayList = friends;
        title = `Tümü — ${friends.length}`;
        break;
      case 'online':
        displayList = friends.filter(f => Math.random() > 0.5);
        title = `Çevrimiçi — ${displayList.length}`;
        break;
      case 'pending':
        displayList = friendRequests.received;
        title = `Bekleyen — ${friendRequests.received.length}`;
        break;
      case 'blocked':
        displayList = blockedUsers;
        title = `Engellenen — ${blockedUsers.length}`;
        break;
    }

    return (
      <>
        <div style={{
          color: '#b9bbbe',
          fontSize: '12px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          padding: '16px 20px 8px 20px',
          borderBottom: '1px solid #202225',
          marginBottom: '16px'
        }}>
          {title}
        </div>

        <div style={{ padding: '0 20px' }}>
          {displayList.length === 0 ? (
            <div style={{
              color: '#8e9297',
              textAlign: 'center',
              padding: '40px 20px',
              fontSize: '14px'
            }}>
              {friendsFilter === 'all' && 'Henüz arkadaşın yok. Arkadaş ekle butonunu kullanarak yeni arkadaşlar bulabilirsin!'}
              {friendsFilter === 'online' && 'Çevrimiçi arkadaş yok'}
              {friendsFilter === 'pending' && 'Bekleyen arkadaş isteği yok'}
              {friendsFilter === 'blocked' && 'Engellenmiş kullanıcı yok'}
            </div>
          ) : (
            displayList.map((item) => {
              const displayUser = friendsFilter === 'pending' ? item.requester : 
                                friendsFilter === 'blocked' ? item.blocked_user : item.friend;
              
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    // DÜZELTILDI: Sadece 'all' filtresi için DM başlat
                    if (friendsFilter === 'all') {
                      console.log('Clicking on friend:', displayUser.username); // Debug log
                      handleFriendClick(displayUser);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    cursor: friendsFilter === 'all' ? 'pointer' : 'default',
                    marginBottom: '4px',
                    backgroundColor: 'transparent',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (friendsFilter === 'all') {
                      e.currentTarget.style.backgroundColor = '#34373c';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (friendsFilter === 'all') {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
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
                      fontWeight: 'bold'
                    }}>
                      {displayUser.username.charAt(0).toUpperCase()}
                    </div>
                    {(friendsFilter === 'all' || friendsFilter === 'online') && (
                      <div style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: getStatusColor(Math.random() > 0.5 ? 'online' : 'offline'),
                        border: '2px solid #36393f'
                      }}></div>
                    )}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {displayUser.username}
                    </div>
                    <div style={{
                      color: '#b9bbbe',
                      fontSize: '12px'
                    }}>
                      {friendsFilter === 'pending' ? 'Gelen arkadaş isteği' : 
                       friendsFilter === 'blocked' ? 'Engellenmiş' : 'Çevrimiçi'}
                    </div>
                  </div>

                  {/* Sağ taraf butonları */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {friendsFilter === 'all' && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Parent click'i engelle
                            console.log('Message button clicked for:', displayUser.username);
                            handleFriendClick(displayUser);
                          }}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: '#36393f',
                            border: 'none',
                            color: '#dcddde',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px'
                          }}
                          title="Mesaj Gönder"
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#43b581'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#36393f'}
                        >
                          💬
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('More options for:', displayUser.username);
                          }}
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: '#36393f',
                            border: 'none',
                            color: '#dcddde',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px'
                          }}
                          title="Daha Fazla"
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4f545c'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#36393f'}
                        >
                          ⋮
                        </button>
                      </div>
                    )}

                    {friendsFilter === 'pending' && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFriendRequest(item.id, 'accept');
                          }}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#43b581',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          ✓
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFriendRequest(item.id, 'reject');
                          }}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: '#f04747',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </>
    );
  };

  return (
    <div style={{
      flex: 1,
      backgroundColor: '#36393f',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh'
    }}>
      {/* Header with filters */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #202225'
      }}>
        {/* Filter Buttons */}
        <div style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '20px'
        }}>
          {[
            { key: 'online', label: 'Çevrimiçi' },
            { key: 'all', label: 'Tümü' },
            { key: 'pending', label: 'Bekleyen' },
            { key: 'blocked', label: 'Engellenen' }
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setFriendsFilter(filter.key as any)}
              style={{
                backgroundColor: friendsFilter === filter.key ? '#43b581' : 'transparent',
                border: 'none',
                color: friendsFilter === filter.key ? 'white' : '#b9bbbe',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: friendsFilter === filter.key ? 'bold' : 'normal'
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Add Friend Button */}
        <button
          onClick={() => setShowAddFriend(!showAddFriend)}
          style={{
            backgroundColor: '#43b581',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          Arkadaş Ekle
        </button>

        {/* Add Friend Search */}
        {showAddFriend && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Kullanıcı adı ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: '#40444b',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#5865F2',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {loading ? '...' : 'Ara'}
              </button>
            </div>

            {/* Search Results */}
            {searchResults.map((result) => (
              <div
                key={result.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 12px',
                  marginBottom: '4px',
                  backgroundColor: '#2f3136',
                  borderRadius: '4px',
                  border: '1px solid #202225'
                }}
              >
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
                  marginRight: '12px',
                  fontSize: '12px'
                }}>
                  {result.username.charAt(0).toUpperCase()}
                </div>
                <span style={{ flex: 1, color: 'white', fontSize: '14px' }}>
                  {result.username}
                </span>
                
                {result.is_friend ? (
                  <span style={{ color: '#43b581', fontSize: '12px' }}>Arkadaş</span>
                ) : result.has_pending_request ? (
                  <span style={{ color: '#faa61a', fontSize: '12px' }}>Gönderildi</span>
                ) : result.has_received_request ? (
                  <span style={{ color: '#5865F2', fontSize: '12px' }}>Bekleyen</span>
                ) : result.is_blocked ? (
                  <span style={{ color: '#f04747', fontSize: '12px' }}>Engellenmiş</span>
                ) : (
                  <button
                    onClick={() => handleSendFriendRequest(result.id)}
                    style={{
                      padding: '4px 12px',
                      backgroundColor: '#43b581',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Ekle
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Friends List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {renderFriendsList()}
      </div>
    </div>
  );
};

export default FriendsManagementPanel;