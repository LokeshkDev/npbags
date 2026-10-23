'use client';

import React from 'react';
import Link from 'next/link';
import { useCart } from '../../lib/cart-context';
import { useWishlist } from '../../lib/wishlist-context';

const screenshotBestSellers = [
  {
    id: 101,
    name: 'Women Handbag',
    category_name: 'Bags & Handbags',
    price: 1499,
    rating: 4.8,
    reviews: '(4.5)',
    image: '/assets/bestsellers/best-handbag.png',
    slug: 'women-handbag'
  },
  {
    id: 102,
    name: 'Designer Earrings',
    category_name: 'Jewellery',
    price: 699,
    rating: 4.9,
    reviews: '(4.3)',
    image: '/assets/bestsellers/best-earrings.png',
    slug: 'designer-earrings'
  },
  {
    id: 103,
    name: "Men's Casual Shoes",
    category_name: 'Footwear',
    price: 1299,
    rating: 4.7,
    reviews: '(4.4)',
    image: '/assets/bestsellers/best-shoes.png',
    slug: 'mens-casual-shoes'
  },
  {
    id: 104,
    name: 'Kids Water Bottle',
    category_name: 'Water Bottles',
    price: 499,
    rating: 4.9,
    reviews: '(4.6)',
    image: '/assets/bestsellers/best-bottle.png',
    slug: 'kids-water-bottle'
  },
  {
    id: 105,
    name: 'Key Chain',
    category_name: 'Accessories',
    price: 299,
    rating: 4.6,
    reviews: '(4.4)',
    image: '/assets/bestsellers/best-keychain.png',
    slug: 'key-chain'
  },
  {
    id: 106,
    name: "Men's Slippers",
    category_name: 'Footwear',
    price: 799,
    rating: 4.7,
    reviews: '(4.5)',
    image: '/assets/bestsellers/best-slippers.png',
    slug: 'mens-slippers'
  }
];

export function BestSellingSection({ products: apiProducts = [] }) {
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();

  const products = (Array.isArray(apiProducts) && apiProducts.length >= 6)
    ? apiProducts.slice(0, 6).map((p, idx) => ({
        id: p.id || 100 + idx,
        name: p.name || screenshotBestSellers[idx]?.name,
        price: p.price || screenshotBestSellers[idx]?.price,
        rating: p.rating || 4.8,
        reviews: `(${p.rating || 4.5})`,
        image: p.image || p.primary_image || screenshotBestSellers[idx]?.image,
        slug: p.slug || screenshotBestSellers[idx]?.slug
      }))
    : screenshotBestSellers;

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
                    onClick={() => addToCart(product, 1)}
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
