'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../../components/Icons';
import { loginAdmin, setAdminToken } from '../../lib/api';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@npgrand.com');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = await loginAdmin(email, password);
      if (data && data.token) {
        setAdminToken(data.token);
        if (typeof window !== 'undefined' && data.user) {
          localStorage.setItem('npgrand_admin_user', JSON.stringify(data.user));
        }
        router.push('/dashboard');
      } else {
        // Fallback demo login
        setAdminToken('demo_admin_jwt_token_2026');
        router.push('/dashboard');
      }
    } catch (err) {
      // In offline/initial mode, allow demo login with default credentials
      if (email === 'admin@npgrand.com' && password === 'admin123') {
        setAdminToken('demo_admin_jwt_token_2026');
        router.push('/dashboard');
      } else {
        setError(err.message || 'Invalid administrator credentials');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#191f1c', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '420px', background: '#ffffff', borderRadius: '16px', padding: '36px 32px', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src="/assets/brand-logo.png"
            alt="NP Grand"
            style={{ height: '44px', width: 'auto', marginBottom: '16px' }}
          />
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-heading)' }}>
            Admin Control Center
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '6px' }}>
            Authorized administrative access only
          </p>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '20px', border: '1px solid #fecaca' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Admin Email Address</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ paddingLeft: '38px' }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}>
                <Icon name="mail" size={16} />
              </span>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                className="form-control"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingLeft: '38px' }}
              />
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', display: 'flex' }}>
                <Icon name="shieldCheck" size={16} />
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="admin-btn admin-btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Icon name="check" size={16} />
            <span>{loading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: 'var(--muted)' }}>
          Default Credentials: <code>admin@npgrand.com</code> / <code>admin123</code>
        </div>
      </div>
    </div>
  );
}

