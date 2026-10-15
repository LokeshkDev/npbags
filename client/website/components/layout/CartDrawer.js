'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '../common/Icons';
import { useCart } from '../../lib/cart-context';

export function CartDrawer() {
  const router = useRouter();
  const {
    cart,
    count,
    subtotal,
    isOpen,
    closeCart,
    updateQty
  } = useCart();

  const handleCheckout = () => {
    closeCart();
    router.push('/checkout');
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
          {cart.length === 0 ? (
            <div className="cart-empty">Your bag is waiting for something lovely.</div>
          ) : (
            cart.map((item, i) => (
              <div className="cart-line" key={`${item.id}-${item.size}-${item.color}-${i}`}>
                <img src={item.image} alt={item.name} />
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
                <strong>₹{(item.price * item.qty).toFixed(2)}</strong>
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
