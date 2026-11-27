'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useCart } from '../../lib/cart-context';
import { useWishlist } from '../../lib/wishlist-context';
import { useQuickView } from '../../lib/quickview-context';
import {
  hasProductModelVariants,
  resolveVariantImage,
  getVariantDisplayLabel,
  getVariantSubLabel,
  getVariantPricing
} from '../../lib/variant-utils';

export function ProductCard({
  product,
  index = 0,
  showRating = true,
  isShop = false,
  fullImage = false
}) {
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const { openQuickView } = useQuickView();

  const preselected = product._preselectedVariant || null;
  const hasModels = !preselected && hasProductModelVariants(product);
  const variants = Array.isArray(product.variants) ? product.variants : [];
  const defaultVariant = preselected || (hasModels
    ? (variants.find(v => (Number(v.stock_quantity) || 0) > 0) || variants[0])
    : null);

  const [selectedVariantId, setSelectedVariantId] = useState(defaultVariant?.id ?? null);

  const activeVariant = preselected || (hasModels
    ? (variants.find(v => String(v.id) === String(selectedVariantId)) || defaultVariant)
    : null);

  const detailHref = activeVariant
    ? `/product/${product.slug || product.id}?model=${encodeURIComponent(activeVariant.model_name || activeVariant.id)}`
    : `/product/${product.slug || product.id}`;

  const fallbackImg = product.primary_image || (product.gallery && product.gallery[0]) || (product.images && product.images[0]) || (product.colors && product.colors[0]?.img) || product.image || '/assets/brand-logo.png';
  const mainImg = activeVariant ? resolveVariantImage(activeVariant, product) : fallbackImg;

  const { price, salePrice, mrp, hasSale, unitPrice } = activeVariant
    ? getVariantPricing(activeVariant, product)
    : {
        price: typeof product.price === 'number' ? product.price : parseFloat(product.price || 0),
        salePrice: typeof product.sale_price === 'number' ? product.sale_price : parseFloat(product.sale_price || 0),
        mrp: typeof product.mrp === 'number' ? product.mrp : parseFloat(product.mrp || 0),
        hasSale: (parseFloat(product.sale_price || 0) > 0 && parseFloat(product.sale_price || 0) < parseFloat(product.price || 0)),
        unitPrice: (parseFloat(product.sale_price || 0) > 0 && parseFloat(product.sale_price || 0) < parseFloat(product.price || 0))
          ? parseFloat(product.sale_price || 0)
          : (parseFloat(product.sale_price || 0) > 0 && parseFloat(product.price || 0) === 0 ? parseFloat(product.sale_price || 0) : parseFloat(product.price || 0))
      };

  const strikePrice = (hasSale && price > unitPrice) ? price : (mrp > unitPrice ? mrp : 0);
  const hasStrikeOffer = strikePrice > unitPrice;
  const formatCardPrice = (num) => {
    const n = Number(num || 0);
    return Number.isInteger(n) ? String(n) : n.toFixed(2);
  };

  const inWish = isInWishlist(product.id);
  const ratingVal = product.rating ? Number(product.rating).toFixed(1) : '4.8';
  const visibleModelVariants = variants.slice(0, 4);
  const extraModelCount = Math.max(0, variants.length - visibleModelVariants.length);

  return (
    <article
      className={`product-card ${isShop ? 'product-card--shop' : ''}`}
      data-product-id={product.id}
      data-index={index}
    >
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
          <path d="M2 12C2 12 5 5 12 5C19 5 22 12 22 12C22 12 19 19 12 19C5 19 2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {/* Product Media */}
      <div
        className="product-media"
        style={fullImage || isShop ? { background: '#ffffff', padding: '6px' } : undefined}
      >
        <Link href={detailHref} className="product-card__img-link" aria-label={`View details for ${product.name}`}>
          {mainImg ? (
            <img
              src={mainImg}
              alt={product.name}
              loading="lazy"
              style={fullImage || isShop ? { objectFit: 'contain', width: '100%', height: '100%' } : undefined}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/assets/brand-logo.png';
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#f5f5f5' }} />
          )}
        </Link>
        {product.badge && <span className="product-badge">{product.badge}</span>}
      </div>

      {/* Product Info */}
      <div className="product-info">
        <h3 className="product-title">
          <Link href={detailHref}>{product.name}</Link>
        </h3>

        {hasModels && visibleModelVariants.length > 0 && (
          <div className="product-card__models" aria-label="Available models">
            {visibleModelVariants.map((v, vIdx) => {
              const isSelected = String(v.id) === String(activeVariant?.id);
              const vImg = resolveVariantImage(v, product);
              const vLabel = getVariantDisplayLabel(v, vIdx);
              return (
                <button
                  key={v.id || vIdx}
                  type="button"
                  className={`product-card__model-chip ${isSelected ? 'is-active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedVariantId(v.id);
                  }}
                  title={vLabel}
                >
                  <img
                    src={vImg}
                    alt={vLabel}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = '/assets/brand-logo.png';
                    }}
                  />
                  <span>{vLabel}</span>
                </button>
              );
            })}
            {extraModelCount > 0 && (
              <Link href={`/product/${product.slug || product.id}`} className="product-card__model-more">
                +{extraModelCount}
              </Link>
            )}
          </div>
        )}
        
        <div className="product-price">
          <span className="product-price__current">₹{formatCardPrice(unitPrice)}</span>
          {hasStrikeOffer && (
            <del className="product-price__strike">₹{formatCardPrice(strikePrice)}</del>
          )}
        </div>

        {/* Product Rating (Hidden on Shop pages) */}
        {showRating && (
          <div className="product-rating">
            <span className="rating-stars">★★★★★</span>
            <span className="rating-reviews">({ratingVal})</span>
          </div>
        )}

        <button
          type="button"
          className="add-cart-btn"
          onClick={() => {
            if (activeVariant) {
              const modelName = activeVariant.model_name ? String(activeVariant.model_name).trim() : '';
              const subLabel = getVariantSubLabel(activeVariant);
              const variantInfo = [modelName, subLabel].filter(Boolean).join(' · ') || activeVariant.color_name || '';
              addToCart(
                { ...product, name: product._baseProductName || product.name, price, sale_price: salePrice, mrp },
                {
                  qty: 1,
                  variant_id: activeVariant.id,
                  model_name: modelName,
                  sku: activeVariant.sku || '',
                  variant_info: variantInfo,
                  color: activeVariant.color_name || '',
                  size: activeVariant.size_name && !/^(standard|one size)$/i.test(activeVariant.size_name) ? activeVariant.size_name : '',
                  image: mainImg
                }
              );
            } else {
              addToCart(product, { qty: 1, image: mainImg });
            }
          }}
        >
          Add to Cart
        </button>
      </div>
    </article>
  );
}
