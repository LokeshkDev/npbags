'use client';

import React, { useState } from 'react';
import { subscribeNewsletter } from '../../lib/api';

export function NewsletterSection({ data }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ state: 'idle', message: '' });

  if (data && data.is_visible === false) return null;

  const sectionTitle = data?.title || 'Subscribe for Exclusive Offers';
  const sectionSub = data?.subtitle || 'Be the first to know about new arrivals, special offers and more.';
  const sectionIcon = data?.icon || '/assets/banners/newsletter-icon.png';
  const buttonText = data?.button_text || 'Subscribe';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setStatus({ state: 'loading', message: '' });
    try {
      await subscribeNewsletter(email);
      setStatus({ state: 'success', message: 'Thank you! You have subscribed successfully.' });
      setEmail('');
    } catch (err) {
      setStatus({ state: 'error', message: err.message || 'Subscription failed. Please try again.' });
    }
  };

  return (
    <section className="newsletter-section" aria-label="Newsletter">
      <div className="container-full">
        <div className="newsletter-card">
          <div className="newsletter-card__left">
            <div className="newsletter-icon-wrap" aria-hidden="true">
              <img src={sectionIcon} alt="Newsletter" className="newsletter-icon-img" />
            </div>
            <div className="newsletter-text">
              <h2 className="newsletter-title">{sectionTitle}</h2>
              <p className="newsletter-sub">{sectionSub}</p>
            </div>
          </div>

          <div
            className="newsletter-form"
            data-lpignore="true"
            data-form-type="other"
          >
            <input
              type="email"
              name="email"
              autoComplete="email"
              className="newsletter-input"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              required
              disabled={status.state === 'loading'}
            />
            <button
              type="button"
              className="newsletter-btn"
              onClick={handleSubmit}
              disabled={status.state === 'loading'}
            >
              <span>{status.state === 'loading' ? 'Subscribing...' : buttonText}</span>
              <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
        </div>
        {status.state === 'success' && (
          <p className="newsletter-alert is-success" role="status" style={{ textAlign: 'center', marginTop: '10px', color: '#065935', fontWeight: 600 }}>
            ✓ {status.message}
          </p>
        )}
        {status.state === 'error' && (
          <p className="newsletter-alert is-error" role="alert" style={{ textAlign: 'center', marginTop: '10px', color: '#c8102e', fontWeight: 600 }}>
            ✕ {status.message}
          </p>
        )}
      </div>
    </section>
  );
}

export default NewsletterSection;
