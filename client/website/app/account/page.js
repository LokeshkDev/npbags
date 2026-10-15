'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../lib/auth-context';

export default function AccountPage() {
  const { user, token, isAuthenticated, login, register, logout } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (isAuthenticated && token) {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      fetch(`${apiBase}/orders/my-orders`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.data) {
            setOrders(data.data);
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register({ name, email, password, phone });
      }
    } catch (err) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated && user) {
    return (
      <div className="account-page" style={{ padding: '40px 0 80px' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', borderBottom: '1px solid var(--line)', paddingBottom: '20px' }}>
            <div>
              <div className="eyebrow">Customer Account</div>
              <h1>Welcome back, {user.name}</h1>
              <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '4px' }}>{user.email}</p>
            </div>
            <button type="button" className="btn btn--outline" onClick={logout} style={{ padding: '8px 18px', fontSize: '13px' }}>
              Sign Out
            </button>
          </div>

          <section style={{ marginBottom: '40px' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Your Orders ({orders.length})</h2>
            {orders.length === 0 ? (
              <div style={{ background: 'var(--surface-soft)', padding: '24px', borderRadius: '10px', textAlign: 'center' }}>
                <p style={{ color: 'var(--muted)' }}>You have not placed any orders yet.</p>
                <Link href="/shop" className="btn" style={{ marginTop: '16px', display: 'inline-block' }}>
                  Start Shopping →
                </Link>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {orders.map(order => (
                  <div key={order.id} style={{ border: '1px solid var(--line)', borderRadius: '10px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid var(--line)', paddingBottom: '10px' }}>
                      <div>
                        <strong>{order.order_number}</strong>
                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          Placed on {new Date(order.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '12px', textTransform: 'uppercase', fontWeight: 700, padding: '4px 10px', borderRadius: '999px', background: order.order_status === 'delivered' ? 'rgba(8, 166, 83, 0.1)' : 'rgba(237, 28, 42, 0.1)', color: order.order_status === 'delivered' ? 'var(--brand-green)' : 'var(--brand-red)' }}>
                          {order.order_status}
                        </span>
                        <div style={{ fontWeight: 700, marginTop: '6px' }}>₹{order.total_amount}</div>
                      </div>
                    </div>

                    <div style={{ fontSize: '13px', color: '#555' }}>
                      {order.items && order.items.map((item, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', margin: '4px 0' }}>
                          <span>{item.quantity}x {item.product_name} {item.variant_info && `(${item.variant_info})`}</span>
                          <span>₹{item.total}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="account-login-page" style={{ padding: '60px 20px 100px', display: 'flex', justifyContent: 'center' }}>
      <div className="container" style={{ maxWidth: '440px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div className="eyebrow">Customer Portal</div>
          <h1>{mode === 'login' ? 'Sign in to your account' : 'Create an account'}</h1>
        </div>

        <div style={{ display: 'flex', borderBottom: '2px solid var(--line)', marginBottom: '24px' }}>
          <button
            type="button"
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: 'none',
              fontWeight: mode === 'login' ? 700 : 500,
              borderBottom: mode === 'login' ? '3px solid var(--brand-red)' : 'none',
              color: mode === 'login' ? 'var(--brand-red)' : 'var(--muted)',
              cursor: 'pointer'
            }}
            onClick={() => setMode('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            style={{
              flex: 1,
              padding: '12px',
              border: 'none',
              background: 'none',
              fontWeight: mode === 'register' ? 700 : 500,
              borderBottom: mode === 'register' ? '3px solid var(--brand-red)' : 'none',
              color: mode === 'register' ? 'var(--brand-red)' : 'var(--muted)',
              cursor: 'pointer'
            }}
            onClick={() => setMode('register')}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Lokesh Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Email Address
            </label>
            <input
              type="email"
              required
              placeholder="customer@npgrand.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Password
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Phone Number (optional)
              </label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}
              />
            </div>
          )}

          {error && (
            <div style={{ color: 'var(--brand-red)', fontSize: '13px', background: 'rgba(237, 28, 42, 0.08)', padding: '10px 14px', borderRadius: '6px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn"
            disabled={loading}
            style={{ width: '100%', marginTop: '8px', padding: '14px' }}
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>
        </form>
      </div>
    </div>
  );
}

