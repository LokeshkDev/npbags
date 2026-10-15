import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Our Story — Everyday, Elevated | NP Grand',
  description: 'Learn about our passion for sustainable materials, mindful design, and handcrafted quality.'
};

export default function AboutPage() {
  return (
    <div className="about-page" style={{ padding: '60px 0 100px' }}>
      <div className="container" style={{ maxWidth: '900px' }}>
        <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: '32px' }}>
          <Link href="/">Home</Link>
          <span className="breadcrumbs-sep" aria-hidden="true">/</span>
          <span className="breadcrumbs-current">Our Story</span>
        </nav>

        <div className="eyebrow">Thoughtful Craftsmanship</div>
        <h1 style={{ fontSize: '42px', lineHeight: 1.2, marginBottom: '24px' }}>
          We believe the pieces you reach for most should be the ones you love most.
        </h1>

        <div style={{ borderRadius: '12px', overflow: 'hidden', margin: '36px 0', aspectRatio: '16/9' }}>
          <img
            src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=85"
            alt="Handcrafted workshop and sustainable bags"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <div style={{ fontSize: '17px', lineHeight: 1.9, color: '#333', display: 'grid', gap: '24px' }}>
          <p>
            NP Grand started with a singular observation: everyday bags were either purely utilitarian without aesthetic warmth, or delicate fashion pieces that lacked durability for daily commute and real travel.
          </p>
          <p>
            We set out to create something balanced—bags engineered with architectural clarity, durable water-repellent GOTS-certified organic cotton canvas, vegetable-tanned leather trims, and purposeful interior organisation.
          </p>
          <p>
            Every pocket, key leash, and reinforced strap drop is tested in real daily journeys. Whether navigating crowded morning transit or packing for a spontaneous 3-day weekend, our pieces are built to be lived in.
          </p>
        </div>

        <div style={{ marginTop: '48px', padding: '36px', background: 'var(--surface-soft)', borderRadius: '12px', border: '1px solid var(--line)' }}>
          <h2 style={{ fontSize: '24px', marginBottom: '12px' }}>Our Sustainability Commitment</h2>
          <p style={{ lineHeight: 1.7, color: '#555' }}>
            We work exclusively with certified ethical mills and audited artisan workshops. Our packaging is 100% plastic-free, recyclable, and printed with soy-based inks.
          </p>
          <Link href="/shop" className="btn" style={{ marginTop: '24px', display: 'inline-block' }}>
            Explore Our Catalog →
          </Link>
        </div>
      </div>
    </div>
  );
}

