import React, { useState, useEffect } from 'react';
import LoginPage from './pages/LoginPage';
import MainApp from './pages/MainApp';
import { SocketProvider } from './contexts/SocketContext';
import { User } from './types';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('discord_token');
    const savedUser = localStorage.getItem('discord_user');
    
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        localStorage.removeItem('discord_token');
        localStorage.removeItem('discord_user');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData: User, token: string) => {
    localStorage.setItem('discord_token', token);
    localStorage.setItem('discord_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('discord_token');
    localStorage.removeItem('discord_user');
    setUser(null);
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh', 
        backgroundColor: '#2F3136',
        color: 'white' 
      }}>
        Yükleniyor...
      </div>
    );
  }

  return (
    <SocketProvider user={user}>
      {user ? (
        <MainApp user={user} onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </SocketProvider>
  );
}

export default App;