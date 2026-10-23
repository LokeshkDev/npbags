'use client';

import React, { useState, useEffect } from 'react';
import { subscribeNewsletter } from '../../lib/api';

export function NewsletterSection({ data }) {
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState({ state: 'idle', message: '' });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (data && data.is_visible === false) return null;

  const sectionTitle = data?.title || 'Connect on WhatsApp';
  const sectionSub = data?.subtitle || 'Get instant updates on new arrivals, flash deals and exclusive VIP offers directly on WhatsApp.';
  const buttonText = data?.button_text || 'Connect';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanDigits = phone.replace(/[^0-9]/g, '');
    if (!cleanDigits || cleanDigits.length < 10) {
      setStatus({ state: 'error', message: 'Please enter a valid 10-digit WhatsApp number.' });
      return;
    }

    setStatus({ state: 'loading', message: '' });
    try {
      await subscribeNewsletter(`+91${cleanDigits.slice(-10)}`);
      setStatus({ state: 'success', message: 'Thank you! You have joined our WhatsApp updates successfully.' });
      setPhone('');
    } catch (err) {
      setStatus({ state: 'error', message: err.message || 'Submission failed. Please try again.' });
    }
  };

  return (
    <section className="newsletter-section" aria-label="WhatsApp Updates">
      <div className="container-full">
        <div className="newsletter-card">
          <div className="newsletter-card__left">
            <div className="newsletter-icon-wrap" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="#25D366">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
              </svg>
            </div>
            <div className="newsletter-text">
              <h2 className="newsletter-title">{sectionTitle}</h2>
              <p className="newsletter-sub">{sectionSub}</p>
            </div>
          </div>

          <form
            className="newsletter-form"
            onSubmit={handleSubmit}
            data-lpignore="true"
            data-form-type="other"
            suppressHydrationWarning
          >
            <span className="newsletter-country-code" style={{ color: '#065935', fontWeight: 700, fontSize: '13.5px', paddingRight: '8px' }}>+91</span>
            <input
              type="tel"
              name="phone"
              autoComplete="tel"
              className="newsletter-input"
              placeholder="Enter your WhatsApp number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
              required
              disabled={status.state === 'loading'}
            />
            <button
              type="submit"
              className="newsletter-btn"
              disabled={status.state === 'loading'}
              suppressHydrationWarning
            >
              <span>{status.state === 'loading' ? 'Connecting...' : buttonText}</span>
              <span aria-hidden="true">&rarr;</span>
            </button>
          </form>
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
