'use client';

import React from 'react';
import Link from 'next/link';
import { useWishlist } from '../../lib/wishlist-context';
import { useCart } from '../../lib/cart-context';
import { Icon } from '../../components/common/Icons';

export default function WishlistPage() {
  const { wishlist, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();

  return (
    <div className="wishlist-page" style={{ padding: '40px 0 80px' }}>
      <div className="container">
        {/* Breadcrumbs */}
        <nav className="breadcrumbs" aria-label="Breadcrumb" style={{ marginBottom: '24px' }}>
          <Link href="/">Home</Link>
          <span className="breadcrumbs-sep" aria-hidden="true">/</span>
          <span className="breadcrumbs-current">Saved Items</span>
        </nav>

        <header className="shop-header" style={{ marginBottom: '36px' }}>
          <div className="eyebrow">Your Favorites</div>
          <h1>Saved Wishlist ({wishlist.length})</h1>
        </header>

        {wishlist.length === 0 ? (
          <div className="shop-empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center', color: 'var(--muted)' }}>
              <Icon name="heart" size={44} />
            </div>
            <h3>Your wishlist is currently empty</h3>
            <p style={{ marginTop: '8px', color: 'var(--muted)' }}>
              Explore our collections and tap the heart icon on any piece you love.
            </p>
            <Link href="/shop" className="btn" style={{ marginTop: '24px', display: 'inline-block' }}>
              Explore Collections →
            </Link>
          </div>
        ) : (
          <div className="product-grid grid-cols-4">
            {wishlist.map((item, idx) => {
              const img = item.primary_image || (item.gallery && item.gallery[0]) || (item.images && item.images[0]) || (item.colors && item.colors[0]?.img) || '';
              return (
                <article className="product-card stagger-item is-revealed" key={item.id}>
                  <div className="product-card__image">
                    <Link href={`/product/${item.slug || item.id}`}>
                      <img src={img} alt={item.name} loading="lazy" />
                    </Link>
                    <button
                      type="button"
                      className="product-action-btn"
                      style={{ position: 'absolute', top: '12px', right: '12px', color: 'var(--brand-red)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      title="Remove from wishlist"
                      onClick={() => toggleWishlist(item)}
                    >
                      <Icon name="heart" size={16} fill="currentColor" />
                    </button>
                  </div>
                  <div className="product-card__details">
                    <div className="product-card__category">{item.category_name || item.cat}</div>
                    <h3 className="product-card__title">
                      <Link href={`/product/${item.slug || item.id}`}>{item.name}</Link>
                    </h3>
                    <div className="product-price">
                      <span>₹{item.price.toFixed(2)}</span>
                    </div>
                    <button
                      type="button"
                      className="product-add"
                      onClick={() => {
                        addToCart(item);
                        toggleWishlist(item);
                      }}
                    >
                      Move to bag +
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

