import React from 'react';

const defaultTrustItems = [
  {
    title: 'Wide Range',
    desc: 'Latest Collections',
    image: '/assets/trust/trust-wide-range.png'
  },
  {
    title: 'Secure Payments',
    desc: '100% Safe & Secure',
    image: '/assets/trust/trust-secure-payments.png'
  },
  {
    title: 'Easy Returns',
    desc: 'Hassle Free Returns',
    image: '/assets/trust/trust-easy-returns.png'
  },
  {
    title: 'Fast Delivery',
    desc: 'Across India',
    image: '/assets/trust/trust-fast-delivery.png'
  }
];

export function TrustStrip({ data }) {
  if (data && data.is_visible === false) return null;

  const trustItems = (data?.items && Array.isArray(data.items) && data.items.length > 0)
    ? data.items
    : defaultTrustItems;

  return (
    <section className="trust-strip" aria-label="Service Guarantees">
      <div className="container">
        <div className="trust-strip__grid">
          {trustItems.map((item, idx) => (
            <div key={idx} className="trust-item">
              <div className="trust-icon-bubble" aria-hidden="true">
                <img src={item.image} alt={item.title} className="trust-icon-img" />
              </div>
              <div>
                <strong className="trust-title">{item.title}</strong>
                <p className="trust-desc">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default TrustStrip;
