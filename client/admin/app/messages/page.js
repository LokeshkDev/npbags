'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Topbar } from '../../components/Topbar';
import { Icon } from '../../components/Icons';
import { getAdminMessages, getAdminSubscribers } from '../../lib/api';

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [activeTab, setActiveTab] = useState('inquiries');

  useEffect(() => {
    getAdminMessages()
      .then(data => {
        if (Array.isArray(data)) setMessages(data);
      })
      .catch(() => {
        setMessages([
          { id: 1, name: 'Ananya Sharma', email: 'ananya@example.com', subject: 'Corporate Gifting Order', message: 'Hello, we would like to order 50 customized Everyday Totes for our annual employee welcome pack. Could you share pricing details?', created_at: '2026-10-14' },
          { id: 2, name: 'Vikram Joshi', email: 'vikram.j@example.com', subject: 'Water-resistance inquiry', message: 'Hi! Is the Commuter Backpack fully waterproof or water-resistant during heavy monsoon rains?', created_at: '2026-10-13' }
        ]);
      });

    getAdminSubscribers()
      .then(data => {
        if (Array.isArray(data)) setSubscribers(data);
      })
      .catch(() => {
        setSubscribers([
          { id: 1, email: 'deepak.patel@example.com', created_at: '2026-10-14' },
          { id: 2, email: 'meera.nair@example.com', created_at: '2026-10-13' },
          { id: 3, email: 'aditya.singh@example.com', created_at: '2026-10-12' }
        ]);
      });
  }, []);

  return (
    <div className="admin-layout">
      <Sidebar />
      <div className="admin-main">
        <Topbar title="Customer Inquiries & Subscribers" />

        <div className="admin-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ink)' }}>Customer Communications</h1>
              <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '4px' }}>
                Review incoming contact submissions and manage newsletter subscriber lists.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--line)', marginBottom: '24px' }}>
            <button
              type="button"
              onClick={() => setActiveTab('inquiries')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === 'inquiries' ? '2px solid var(--brand-red)' : '2px solid transparent',
                color: activeTab === 'inquiries' ? 'var(--brand-red)' : 'var(--muted)',
                fontWeight: activeTab === 'inquiries' ? 700 : 500,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <Icon name="mail" size={16} />
              <span>Contact Messages ({messages.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('subscribers')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                border: 'none',
                background: 'none',
                borderBottom: activeTab === 'subscribers' ? '2px solid var(--brand-red)' : '2px solid transparent',
                color: activeTab === 'subscribers' ? 'var(--brand-red)' : 'var(--muted)',
                fontWeight: activeTab === 'subscribers' ? 700 : 500,
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <Icon name="user" size={16} />
              <span>Subscribers ({subscribers.length})</span>
            </button>
          </div>

          {activeTab === 'inquiries' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {messages.length === 0 ? (
                <div className="stat-card" style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>
                  No customer messages received yet.
                </div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className="stat-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--ink)' }}>{m.subject || 'Store Inquiry'}</h3>
                        <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '2px' }}>
                          From: <strong>{m.name}</strong> &lt;{m.email}&gt;
                        </div>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                        {m.created_at ? new Date(m.created_at).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--ink)', lineHeight: 1.6, background: '#fafbfc', padding: '14px', borderRadius: '8px', border: '1px solid var(--line)' }}>
                      {m.message}
                    </p>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                      <a
                        href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject || 'Your NP Grand Inquiry')}`}
                        className="admin-btn admin-btn-outline"
                        style={{ padding: '6px 14px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Icon name="mail" size={14} />
                        <span>Reply via Email</span>
                      </a>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="stat-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Subscriber Email</th>
                    <th>Subscribed Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {subscribers.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                        No newsletter subscribers yet.
                      </td>
                    </tr>
                  ) : (
                    subscribers.map(sub => (
                      <tr key={sub.id}>
                        <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{sub.email}</td>
                        <td style={{ color: 'var(--muted)', fontSize: '12px' }}>
                          {sub.created_at ? new Date(sub.created_at).toLocaleDateString() : 'Today'}
                        </td>
                        <td>
                          <span className="badge badge-success">Subscribed</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

