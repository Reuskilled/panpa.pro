import React, { useState } from 'react';
import { authApi } from '../services/api';
import { User } from '../types';

interface LoginPageProps {
  onLogin: (user: User, token: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = isLogin
        ? await authApi.login(formData.email, formData.password)
        : await authApi.register(formData.username, formData.email, formData.password);

      if (response.token && response.user) {
        onLogin(response.user, response.token);
      } else {
        setError(response.error || 'Giriş başarısız');
      }
    } catch (error) {
      setError('Bağlantı hatası. Backend çalışıyor mu?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#5865F2'
    }}>
      <div style={{
        backgroundColor: '#2F3136',
        padding: '40px',
        borderRadius: '8px',
        width: '400px',
        boxShadow: '0 8px 16px rgba(0,0,0,0.24)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ color: 'white', marginBottom: '8px', fontSize: '24px' }}>
            {isLogin ? 'Tekrar hoş geldin!' : 'Hesap oluştur'}
          </h1>
          <p style={{ color: '#b9bbbe', margin: 0 }}>
            {isLogin ? 'Seni tekrar görmek çok güzel!' : 'Seni görmek heyecan verici!'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#b9bbbe',
                fontSize: '12px',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                Kullanıcı Adı
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                style={{
                  width: '100%',
                  padding: '10px',
                  backgroundColor: '#40444b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  fontSize: '16px'
                }}
                required={!isLogin}
              />
            </div>
          )}

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#b9bbbe',
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              E-posta
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#40444b',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                fontSize: '16px'
              }}
              required
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              color: '#b9bbbe',
              fontSize: '12px',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              Şifre
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#40444b',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                fontSize: '16px'
              }}
              required
            />
          </div>

          {error && (
            <div style={{
              color: '#f04747',
              backgroundColor: 'rgba(240, 71, 71, 0.1)',
              padding: '10px',
              borderRadius: '3px',
              marginBottom: '20px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: loading ? '#4752c4' : '#5865F2',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Yükleniyor...' : (isLogin ? 'Giriş Yap' : 'Devam Et')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <span style={{ color: '#b9bbbe', fontSize: '14px' }}>
            {isLogin ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? '}
          </span>
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setFormData({ username: '', email: '', password: '' });
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#00AFF4',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            {isLogin ? 'Hesap Oluştur' : 'Giriş Yap'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;