'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ProductCard } from '../product/ProductCard';
import { expandProductsByModel } from '../../lib/variant-utils';

export function BestSellingSection({ products: apiProducts = [] }) {
  const products = useMemo(() => {
    if (!Array.isArray(apiProducts) || apiProducts.length === 0) return [];
    return expandProductsByModel(apiProducts);
  }, [apiProducts]);

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
          {products.map((product, idx) => (
            <ProductCard
              key={product._cardKey || product.id}
              product={product}
              index={idx}
              showRating={true}
              fullImage={true}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default BestSellingSection;
