'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '../../lib/cart-context';
import { useWishlist } from '../../lib/wishlist-context';

export function BestSellingSection({ products: apiProducts = [] }) {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const products = (Array.isArray(apiProducts) && apiProducts.length > 0)
    ? apiProducts.map((p, idx) => {
        const rawImg = p.primary_image || (p.images && p.images[0]) || p.image || '/assets/bestsellers/best-handbag.png';
        const ratingVal = p.rating ? Number(p.rating).toFixed(1) : '4.8';
        return {
          id: p.id,
          name: p.name,
          category_name: p.category_name || 'Accessories',
          price: p.price,
          rating: ratingVal,
          reviews: `(${ratingVal})`,
          image: rawImg,
          primary_image: p.primary_image || rawImg,
          slug: p.slug || p.id
        };
      })
    : [];

  if (products.length === 0) return null;

  return (
    <section className="bestsellers-section" aria-label="Best Sellers">
      <div className="container">
        <div className="bestsellers-header">
          <div>
            <h2 className="bestsellers-title">
              <span className="title-green">Best</span> <span className="title-red">Sellers</span>
            </h2>
            <p className="bestsellers-sub">Our most loved products</p>
          </div>
          <Link href="/shop?filter=best-selling" className="bestsellers-view-btn">
            <span>View All</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>

        <div className="bestsellers-grid">
          {products.map((product) => {
            const isFav = isInWishlist(product.id);
            return (
              <article key={product.id} className="product-card">
                <button
                  type="button"
                  className={`wishlist-btn ${isFav ? 'is-active' : ''}`}
                  aria-label="Add to wishlist"
                  suppressHydrationWarning
                  onClick={() => toggleWishlist(product)}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill={isFav ? '#c8102e' : 'none'} stroke={isFav ? '#c8102e' : '#111827'} strokeWidth="1.8">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
                <div className="product-media">
                  <img src={product.image} alt={product.name} loading="lazy" />
                </div>
                <div className="product-info">
                  <h3 className="product-title">
                    <Link href={`/product/${product.slug || product.id}`}>{product.name}</Link>
                  </h3>
                  <div className="product-price">₹{Number(product.price).toLocaleString('en-IN')}</div>
                  <div className="product-rating">
                    <span className="rating-stars">★★★★★</span>
                    <span className="rating-reviews">{product.reviews}</span>
                  </div>
                  <button
                    type="button"
                    className="add-cart-btn"
                    onClick={() => addToCart(product, { qty: 1, image: product.primary_image || product.image })}
                  >
                    Add to Cart
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default BestSellingSection;
