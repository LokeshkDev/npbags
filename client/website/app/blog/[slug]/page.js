import React from 'react';
import Link from 'next/link';

export default function BlogDetailPage({ params }) {
  const { slug } = params;

  return (
    <div className="blog-detail-page" style={{ padding: '60px 0 100px' }}>
      <div className="container" style={{ maxWidth: '800px' }}>
        <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: '32px' }}>
          <Link href="/">Home</Link>
          <span className="breadcrumbs-sep" aria-hidden="true">/</span>
          <Link href="/blog">Editorial</Link>
          <span className="breadcrumbs-sep" aria-hidden="true">/</span>
          <span className="breadcrumbs-current">Story</span>
        </nav>

        <div className="eyebrow">Behind the Craft</div>
        <h1 style={{ fontSize: '38px', lineHeight: 1.25, marginBottom: '16px' }}>
          Sustainable Canvas: Inside Our Organic Cotton Weave
        </h1>
        <div style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '32px' }}>
          Published by Elena Vance · October 12, 2026 · 4 min read
        </div>

        <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '36px', aspectRatio: '16/9' }}>
          <img
            src="https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1200&q=85"
            alt="Organic canvas weaving"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        <div style={{ fontSize: '17px', lineHeight: 1.9, color: '#333', display: 'grid', gap: '24px' }}>
          <p>
            At NP Grand, sustainability is not an afterthought—it is the very architecture of how we design. Every yard of our signature cotton canvas undergoes custom spinning for abrasion resistance, ensuring that a bag purchased today remains your trusted companion for years to come.
          </p>
          <p>
            Traditional canvas production often relies on chemical sizing agents to impart stiffness. Instead, our weavers use a dense two-ply warp and weft weave that naturally holds its shape without synthetic coatings.
          </p>
          <p>
            The result is a textile that softens with age while preserving structural integrity. Complemented by vegetable-tanned leather handles that develop a rich, personal patina over time, each tote tells the story of the journeys you take together.
          </p>
        </div>

        <div style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/blog" style={{ color: 'var(--brand-red)', fontWeight: 600 }}>
            ← Back to all stories
          </Link>
          <Link href="/shop" className="btn">
            Shop the Collection →
          </Link>
        </div>
      </div>
    </div>
  );
}

