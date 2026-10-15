import React from 'react';
import { Icon } from '../common/Icons';

export function TrustStrip({ data }) {
  if (data && data.is_visible === false) return null;

  const defaultIcons = ['delivery', 'shieldCheck', 'star', 'bag'];

  const items = (data && data.items && data.items.length)
    ? data.items
    : [
        { icon: 'delivery', title: 'Easy everyday style', subtitle: 'Pieces made to be lived in' },
        { icon: 'shieldCheck', title: 'Thoughtful quality', subtitle: 'Details you can feel' },
        { icon: 'star', title: 'Customer-first service', subtitle: 'Here when you need us' },
        { icon: 'bag', title: 'Secure checkout', subtitle: 'Shop with confidence' }
      ];

  return (
    <section className="trust-strip reveal-on-scroll is-revealed">
      <div className="container trust-grid">
        {items.map((item, idx) => {
          const iconKey = item.icon && defaultIcons.includes(item.icon) ? item.icon : defaultIcons[idx % defaultIcons.length];
          return (
            <div className="trust-item stagger-item is-revealed" key={idx}>
              <span className="trust-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={iconKey} size={22} />
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default TrustStrip;
