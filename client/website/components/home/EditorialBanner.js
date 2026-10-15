import React from 'react';
import Link from 'next/link';

export function EditorialBanner({ data }) {
  if (data && data.is_visible === false) return null;

  const eyebrow = data?.eyebrow || 'A little more considered';
  const heading = data?.heading || 'Good design.<br>Better everyday.';
  const text = data?.text || "We believe the pieces you reach for most should be the ones you love most. That's why we focus on useful details, considered design and lasting style.";
  const image = data?.image || 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1100&q=85';
  const buttonText = data?.buttonText || 'Get to know us →';
  const buttonLink = data?.buttonLink || '/about';

  return (
    <section className="section reveal-on-scroll is-revealed" id="story">
      <div className="container">
        <div className="editorial">
          <div className="editorial__image">
            <img
              src={image}
              alt="A thoughtfully designed bag ready for a day out"
              loading="lazy"
            />
          </div>
          <div className="editorial__content">
            <div className="eyebrow">{eyebrow}</div>
            <h2 dangerouslySetInnerHTML={{ __html: heading }} />
            <p>{text}</p>
            <Link href={buttonLink} className="btn">
              {buttonText}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

