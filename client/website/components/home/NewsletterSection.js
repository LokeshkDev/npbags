'use client';

import React, { useState } from 'react';
import { subscribeNewsletter } from '../../lib/api';

export function NewsletterSection({ data }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ state: 'idle', message: '' });

  if (data && data.is_visible === false) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setStatus({ state: 'loading', message: '' });
    try {
      await subscribeNewsletter(email);
      setStatus({ state: 'success', message: 'Thank you! You are now subscribed.' });
      setEmail('');
    } catch (err) {
      setStatus({ state: 'error', message: err.message || 'Subscription failed. Please try again.' });
    }
  };

  return (
    <section className="section newsletter reveal-on-scroll is-revealed">
      <div className="container newsletter__inner">
        <div className="eyebrow">{data?.eyebrow || 'The good stuff, occasionally'}</div>
        <h2>{data?.heading || 'Join our community'}</h2>
        <p>{data?.text || 'Get first access to new arrivals, thoughtful edits and special offers.'}</p>

        <form className="newsletter-form" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="newsletter-email">Email address</label>
          <input
            id="newsletter-email"
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={status.state === 'loading'}
          />
          <button className="btn" type="submit" disabled={status.state === 'loading'}>
            {status.state === 'loading' ? 'Joining...' : (data?.buttonText || 'Sign me up →')}
          </button>
        </form>

        {status.state === 'success' && (
          <div style={{ marginTop: '14px', color: 'var(--brand-green)', fontWeight: 600, fontSize: '14px' }}>
            {status.message}
          </div>
        )}
        {status.state === 'error' && (
          <div style={{ marginTop: '14px', color: 'var(--brand-red)', fontWeight: 600, fontSize: '14px' }}>
            {status.message}
          </div>
        )}
      </div>
    </section>
  );
}

