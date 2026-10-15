'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { submitContact } from '../../lib/api';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [status, setStatus] = useState({ state: 'idle', message: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ state: 'loading', message: '' });
    try {
      await submitContact(formData);
      setStatus({ state: 'success', message: 'Thank you! Your message has been sent. We will respond within 24 hours.' });
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setStatus({ state: 'error', message: err.message || 'Failed to send message. Please try again.' });
    }
  };

  return (
    <div className="contact-page" style={{ padding: '60px 0 100px' }}>
      <div className="container" style={{ maxWidth: '960px' }}>
        <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: '32px' }}>
          <Link href="/">Home</Link>
          <span className="breadcrumbs-sep" aria-hidden="true">/</span>
          <span className="breadcrumbs-current">Contact Us</span>
        </nav>

        <div className="eyebrow">Here for you</div>
        <h1 style={{ marginBottom: '16px' }}>Get in touch</h1>
        <p style={{ color: 'var(--muted)', fontSize: '16px', marginBottom: '48px', maxWidth: '600px' }}>
          Have a question regarding an order, material specifications, or custom gifting? Our concierge team is happy to assist.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '48px', alignItems: 'start' }}>
          {/* Contact Form */}
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Your Name *
              </label>
              <input
                type="text"
                required
                placeholder="Lokesh Sharma"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Subject (optional)
              </label>
              <input
                type="text"
                placeholder="Order tracking, product inquiry, etc."
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
                Your Message *
              </label>
              <textarea
                required
                rows={5}
                placeholder="How can we help you today?"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line)', fontFamily: 'inherit' }}
              />
            </div>

            {status.state === 'success' && (
              <div style={{ color: 'var(--brand-green)', fontWeight: 600, fontSize: '14px', background: 'rgba(8, 166, 83, 0.08)', padding: '12px', borderRadius: '6px' }}>
                {status.message}
              </div>
            )}
            {status.state === 'error' && (
              <div style={{ color: 'var(--brand-red)', fontWeight: 600, fontSize: '14px', background: 'rgba(237, 28, 42, 0.08)', padding: '12px', borderRadius: '6px' }}>
                {status.message}
              </div>
            )}

            <button
              type="submit"
              className="btn"
              disabled={status.state === 'loading'}
              style={{ width: '100%', padding: '14px' }}
            >
              {status.state === 'loading' ? 'Sending message...' : 'Send Message →'}
            </button>
          </form>

          {/* Contact Information Cards */}
          <div style={{ background: 'var(--surface-soft)', padding: '36px', borderRadius: '12px', border: '1px solid var(--line)' }}>
            <h3 style={{ fontSize: '20px', marginBottom: '20px' }}>Direct Inquiries</h3>

            <div style={{ display: 'grid', gap: '20px', fontSize: '14px', lineHeight: 1.6 }}>
              <div>
                <strong>Customer Support Email:</strong>
                <div>support@npgrand.com</div>
              </div>

              <div>
                <strong>Phone Concierge:</strong>
                <div>+91 98765 43210 (Mon–Fri, 10am – 6pm IST)</div>
              </div>

              <div>
                <strong>Design Studio & Headquarters:</strong>
                <div>Plot 42, Creative District, Indiranagar, Bengaluru, KA, India</div>
              </div>

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', marginTop: '8px' }}>
                <strong>Average Response SLA:</strong>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>Within 2 business hours during weekday hours.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

