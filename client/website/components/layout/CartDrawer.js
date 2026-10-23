'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '../common/Icons';
import { useCart } from '../../lib/cart-context';
import { useAuth } from '../../lib/auth-context';

export function CartDrawer() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    cart,
    count,
    subtotal,
    isOpen,
    closeCart,
    updateQty,
    removeFromCart
  } = useCart();

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('drawer-open');
      const handleKeyDown = (e) => {
        if (e.key === 'Escape') closeCart();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.classList.remove('drawer-open');
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.classList.remove('drawer-open');
    }
  }, [isOpen, closeCart]);

  const handleCheckout = () => {
    closeCart();
    if (!user) {
      router.push('/account?redirect=/checkout');
    } else {
      router.push('/checkout');
    }
  };

  return (
    <>
      <div
        className={`cart-overlay ${isOpen ? 'is-open' : ''}`}
        onClick={closeCart}
        aria-hidden={!isOpen}
        data-cart-close
      />
      <aside
        className={`cart-panel ${isOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping bag"
      >
        <div className="cart-head">
          <h2>Your bag <span data-drawer-count>({count})</span></h2>
          <button
            type="button"
            className="icon-button"
            onClick={closeCart}
            aria-label="Close shopping bag"
            data-cart-close
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="cart-items" data-cart-items>
          {(!cart || cart.length === 0) ? (
            <div className="cart-empty">Your bag is waiting for something lovely.</div>
          ) : (
            cart.map((item, i) => (
              <div className="cart-line" key={`${item.id}-${item.size}-${item.color}-${i}`}>
                <img
                  src={item.image || '/assets/bestsellers/best-handbag.png'}
                  alt={item.name}
                  onError={(e) => { e.currentTarget.src = '/assets/bestsellers/best-handbag.png'; }}
                  style={{ width: '68px', height: '82px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #ebe6df', background: '#f8f8f8', flexShrink: 0 }}
                />
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    ₹{item.price.toFixed(2)} {item.size ? `· ${item.size}` : ''}
                  </small>
                  <div className="cart-line-actions">
                    <button
                      type="button"
                      onClick={() => updateQty(i, item.qty - 1)}
                      aria-label={`Decrease quantity for ${item.name}`}
                      data-qty-minus={i}
                    >
                      −
                    </button>
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateQty(i, item.qty + 1)}
                      aria-label={`Increase quantity for ${item.name}`}
                      data-qty-plus={i}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    className="cart-remove-item-btn"
                    onClick={() => removeFromCart(i)}
                    aria-label={`Remove ${item.name} from bag`}
                    title="Remove item"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#9ca3af',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.color = '#c8102e'; e.currentTarget.style.backgroundColor = 'rgba(200, 16, 46, 0.08)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                  <strong style={{ fontSize: '13.5px', marginTop: '10px', color: 'var(--ink)' }}>₹{(item.price * item.qty).toFixed(2)}</strong>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="cart-foot">
          <div className="cart-total">
            <span>Subtotal</span>
            <span data-cart-total>₹{subtotal.toFixed(2)}</span>
          </div>
          <button
            type="button"
            className="btn"
            style={{ width: '100%' }}
            onClick={handleCheckout}
            data-checkout
          >
            Continue to checkout →
          </button>
          <p style={{ fontSize: '11px', textAlign: 'center', marginTop: '12px', color: 'var(--muted)' }}>
            Shipping and taxes calculated at checkout.
          </p>
        </div>
      </aside>
    </>
  );
}
