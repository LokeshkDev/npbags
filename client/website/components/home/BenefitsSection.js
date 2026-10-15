import React from 'react';
import { Icon } from '../common/Icons';

export function BenefitsSection({ data }) {
  if (data && data.is_visible === false) return null;

  const defaultIcons = ['sparkles', 'shieldCheck', 'user'];

  const cards = (data && data.cards && data.cards.length)
    ? data.cards
    : [
        { icon: 'sparkles', title: 'Considered by design', text: 'Practical details and versatile styles that work with your everyday routine.' },
        { icon: 'shieldCheck', title: 'Made for real life', text: 'Easy-to-use pieces designed to go from busy weekdays to relaxed weekends.' },
        { icon: 'user', title: 'Here for you', text: 'A friendly team and a straightforward shopping experience, every step of the way.' }
      ];

  return (
    <section className="section reveal-on-scroll is-revealed" id="benefits">
      <div className="container">
        <div className="section-heading">
          <div>
            <div className="eyebrow">{data?.eyebrow || 'The difference is in the details'}</div>
            <h2>{data?.heading || 'Why shop with us?'}</h2>
          </div>
        </div>
        <div className="benefits-grid">
          {cards.map((b, idx) => {
            const iconKey = b.icon && defaultIcons.includes(b.icon) ? b.icon : defaultIcons[idx % defaultIcons.length];
            return (
              <article className="benefit stagger-item is-revealed" key={idx}>
                <span className="benefit__icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={iconKey} size={28} />
                </span>
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default BenefitsSection;
