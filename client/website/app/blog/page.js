import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Editorial & Journal — Everyday, Elevated | NP Grand',
  description: 'Stories on sustainable canvas weaving, intentional travel packing, and handcrafted accessories.'
};

const DEMO_ARTICLES = [
  {
    slug: 'sustainable-canvas-revolution',
    title: 'Sustainable Canvas: Inside Our Organic Cotton Weave',
    excerpt: 'How we source GOTS-certified organic cotton to craft long-lasting, weatherproof everyday totes.',
    cover_image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85',
    author: 'Elena Vance',
    date: 'October 12, 2026'
  },
  {
    slug: 'the-art-of-minimalist-packing',
    title: 'The Art of Minimalist Packing for Weekend Getaways',
    excerpt: 'Essential tips for packing 4 days of essentials into an overhead-compliant 38L Weekender duffel.',
    cover_image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1000&q=85',
    author: 'David Kim',
    date: 'October 08, 2026'
  }
];

export default function BlogListPage() {
  return (
    <div className="blog-page" style={{ padding: '60px 0 100px' }}>
      <div className="container">
        <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: '32px' }}>
          <Link href="/">Home</Link>
          <span className="breadcrumbs-sep" aria-hidden="true">/</span>
          <span className="breadcrumbs-current">Editorial Journal</span>
        </nav>

        <header className="shop-header" style={{ marginBottom: '48px' }}>
          <div className="eyebrow">Stories & Craft</div>
          <h1>Editorial Journal</h1>
          <p style={{ color: 'var(--muted)', marginTop: '8px', fontSize: '16px' }}>
            Reflections on design, slow living, and the journeys that shape our days.
          </p>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '40px' }}>
          {DEMO_ARTICLES.map(article => (
            <article key={article.slug} style={{ border: '1px solid var(--line)', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
              <Link href={`/blog/${article.slug}`}>
                <div style={{ aspectRatio: '16/10', overflow: 'hidden' }}>
                  <img
                    src={article.cover_image}
                    alt={article.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
              </Link>
              <div style={{ padding: '24px' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>
                  By {article.author} · {article.date}
                </div>
                <h2 style={{ fontSize: '20px', lineHeight: 1.4, marginBottom: '10px' }}>
                  <Link href={`/blog/${article.slug}`}>
                    {article.title}
                  </Link>
                </h2>
                <p style={{ color: '#555', fontSize: '14px', lineHeight: 1.6, marginBottom: '16px' }}>
                  {article.excerpt}
                </p>
                <Link href={`/blog/${article.slug}`} style={{ fontSize: '13px', fontWeight: 700, color: 'var(--brand-red)' }}>
                  Read story →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

