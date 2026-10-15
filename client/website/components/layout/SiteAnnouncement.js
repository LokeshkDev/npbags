'use client';

import React from 'react';

export function SiteAnnouncement({ data }) {
  const items = (data && data.items && data.items.length)
    ? data.items
    : [
        'Complimentary delivery on qualifying orders over ₹499',
        'Fresh picks. Thoughtful details.',
        'Easy 30-day exchanges'
      ];

  if (data && data.is_active === false) return null;

  const renderGroup = (key) => (
    <div className="announcement__group" key={key}>
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          <span>{item}</span>
          <span aria-hidden="true" className="announcement__star">✦</span>
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <aside className="announcement" aria-label="Store announcement">
      <div className="announcement__track">
        {renderGroup('track-1')}
        {renderGroup('track-2')}
      </div>
    </aside>
  );
}

