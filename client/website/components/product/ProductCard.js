'use client';

import React from 'react';
import Link from 'next/link';
import { Icon } from '../common/Icons';
import { useCart } from '../../lib/cart-context';
import { useWishlist } from '../../lib/wishlist-context';
import { useQuickView } from '../../lib/quickview-context';

export function ProductCard({ product, index = 0 }) {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { openQuickView } = useQuickView();

  const mainImg = product.primary_image || (product.gallery && product.gallery[0]) || (product.images && product.images[0]) || (product.colors && product.colors[0]?.img) || '';
  const price = typeof product.price === 'number' ? product.price : parseFloat(product.price || 0);
  const salePrice = typeof product.sale_price === 'number' ? product.sale_price : parseFloat(product.sale_price || 0);
  const hasSale = salePrice > 0 && salePrice < price;

  const inWish = isInWishlist(product.id);

  return (
    <article className="product-card stagger-item is-revealed" data-product-id={product.id} data-index={index}>
      <div className="product-card__image">
        <Link href={`/product/${product.slug || product.id}`} className="product-card__img-link" aria-label={`View details for ${product.name}`}>
          {mainImg ? (
            <img src={mainImg} alt={product.name} loading="lazy" />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#f5f5f5' }} />
          )}
        </Link>

        {product.badge && <span className="product-badge">{product.badge}</span>}

        <div className="product-card__floating-actions">
          <button
            type="button"
            className="product-action-btn product-quickview-btn"
            aria-label={`Quick view ${product.name}`}
            title="Quick view"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openQuickView(product);
            }}
          >
            <Icon name="eye" size={18} />
            <span className="action-tooltip">Quick view</span>
          </button>

          <button
            type="button"
            className={`product-action-btn product-wish ${inWish ? 'is-active' : ''}`}
            aria-label={inWish ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
            title={inWish ? 'Remove from wishlist' : 'Add to wishlist'}
            style={inWish ? { color: 'var(--brand-red)' } : {}}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWishlist(product);
            }}
          >
            <Icon name="heart" size={16} fill={inWish ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <div className="product-card__details">
        <div className="product-card__category">{product.category_name || product.cat || 'Essential'}</div>
        <h3 className="product-card__title">
          <Link href={`/product/${product.slug || product.id}`}>{product.name}</Link>
        </h3>
        <div className="product-price">
          <span>₹{hasSale ? salePrice.toFixed(2) : price.toFixed(2)}</span>
          {hasSale && <del>₹{price.toFixed(2)}</del>}
        </div>
        <button
          type="button"
          className="product-add"
          onClick={() => addToCart(product)}
        >
          Add to bag +
        </button>
      </div>
    </article>
  );
}

