'use client';

import React from 'react';
import { useCart } from '../../lib/cart-context';

export function Toast() {
  const { toast } = useCart();

  if (!toast) return <div className="toast" role="status" aria-live="polite" />;

  return (
    <div className="toast is-visible" role="status" aria-live="polite">
      {toast}
    </div>
  );
}

