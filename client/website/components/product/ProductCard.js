'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '../../lib/cart-context';
import { useWishlist } from '../../lib/wishlist-context';
import { useQuickView } from '../../lib/quickview-context';

export function ProductCard({ product, index = 0 }) {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { openQuickView } = useQuickView();

  const mainImg = product.primary_image || (product.gallery && product.gallery[0]) || (product.images && product.images[0]) || (product.colors && product.colors[0]?.img) || product.image || '/assets/bestsellers/best-handbag.png';
  const price = typeof product.price === 'number' ? product.price : parseFloat(product.price || 0);
  const salePrice = typeof product.sale_price === 'number' ? product.sale_price : parseFloat(product.sale_price || 0);
  const hasSale = salePrice > 0 && salePrice < price;

  const inWish = isInWishlist(product.id);
  const ratingVal = product.rating ? Number(product.rating).toFixed(1) : '4.8';

  return (
    <article className="product-card" data-product-id={product.id} data-index={index}>
      {/* Wishlist Button */}
      <button
        type="button"
        className={`wishlist-btn ${inWish ? 'is-active' : ''}`}
        aria-label={inWish ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
        title={inWish ? 'Remove from wishlist' : 'Add to wishlist'}
        suppressHydrationWarning
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleWishlist(product);
        }}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill={inWish ? '#c8102e' : 'none'} stroke={inWish ? '#c8102e' : '#111827'} strokeWidth="1.8">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
      </button>

      {/* Quick View Button */}
      <button
        type="button"
        className="quickview-btn"
        aria-label={`Quick view ${product.name}`}
        title="Quick view"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openQuickView(product);
        }}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {/* Product Media */}
      <div className="product-media">
        <Link href={`/product/${product.slug || product.id}`} className="product-card__img-link" aria-label={`View details for ${product.name}`}>
          {mainImg ? (
            <img src={mainImg} alt={product.name} loading="lazy" />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#f5f5f5' }} />
          )}
        </Link>
        {product.badge && <span className="product-badge">{product.badge}</span>}
      </div>

      {/* Product Info */}
      <div className="product-info">
        <h3 className="product-title">
          <Link href={`/product/${product.slug || product.id}`}>{product.name}</Link>
        </h3>
        
        <div className="product-price">
          <span>₹{hasSale ? salePrice.toFixed(2) : price.toFixed(2)}</span>
          {hasSale && <del style={{ color: '#9a9a9a', fontSize: '13px', fontWeight: 400, marginLeft: '6px' }}>₹{price.toFixed(2)}</del>}
        </div>

        <div className="product-rating">
          <span className="rating-stars">★★★★★</span>
          <span className="rating-reviews">({ratingVal})</span>
        </div>

        <button
          type="button"
          className="add-cart-btn"
          onClick={() => addToCart(product, { qty: 1, image: mainImg })}
        >
          Add to Cart
        </button>
      </div>
    </article>
  );
}
