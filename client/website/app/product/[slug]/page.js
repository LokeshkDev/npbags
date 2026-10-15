'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Icon } from '../../../components/common/Icons';
import { ProductCard } from '../../../components/product/ProductCard';
import { useCart } from '../../../lib/cart-context';
import { useWishlist } from '../../../lib/wishlist-context';
import { DEMO_PRODUCTS } from '../../../lib/demo-data';

export default function ProductDetailPage({ params }) {
  const router = useRouter();
  const { slug } = params;
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const [product, setProduct] = useState(null);
  const [activeImage, setActiveImage] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [qty, setQty] = useState(1);
  const [activeTab, setActiveTab] = useState('details'); // 'details', 'materials', 'shipping', 'reviews'
  const [copiedShare, setCopiedShare] = useState(false);

  // Fetch product from API with fallback to DEMO_PRODUCTS
  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    fetch(`${apiBase}/products/${slug}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.data) {
          setupProduct(data.data);
        } else {
          fallbackSetup();
        }
      })
      .catch(() => {
        fallbackSetup();
      });

    function fallbackSetup() {
      const found = DEMO_PRODUCTS.find(p => p.slug === slug || p.id === slug) || DEMO_PRODUCTS[0];
      setupProduct(found);
    }

    function setupProduct(p) {
      setProduct(p);
      const firstColor = p.colors && p.colors[0];
      const firstColorImg = (firstColor && (firstColor.img || firstColor.image_url)) || null;
      const defaultImg = firstColorImg || p.primary_image || (p.gallery && p.gallery[0]) || (p.images && p.images[0]) || '';
      setActiveImage(defaultImg);
      setSelectedColor(firstColor ? firstColor.name : '');
      setSelectedSize(p.sizes && p.sizes[0] ? p.sizes[0] : 'Standard');
      setQty(1);
    }
  }, [slug]);

  // Deduplicate and combine primary image, variant color images, and gallery images (Called unconditionally before returns)
  const gallery = React.useMemo(() => {
    if (!product) return [];
    const list = [];
    const seen = new Set();

    const addImg = (url) => {
      if (url && typeof url === 'string' && url.trim() && !seen.has(url.trim())) {
        seen.add(url.trim());
        list.push(url.trim());
      }
    };

    if (product.primary_image) addImg(product.primary_image);
    (product.colors || []).forEach(c => addImg(c?.img || c?.image_url));
    (product.variants || []).forEach(v => addImg(v?.image_url));
    (product.gallery || []).forEach(addImg);
    (product.images || []).forEach(addImg);
    (product.images_detailed || []).forEach(i => addImg(i?.image_url));
    if (activeImage) addImg(activeImage);

    return list;
  }, [product, activeImage]);

  const inWish = isInWishlist(product?.id);

  if (!product) {
    return (
      <div className="container" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <h2>Loading product...</h2>
      </div>
    );
  }

  const price = typeof product.price === 'number' ? product.price : parseFloat(product.price || 0);
  const salePrice = typeof product.sale_price === 'number' ? product.sale_price : parseFloat(product.sale_price || 0);
  const hasSale = salePrice > 0 && salePrice < price;
  const currentUnitPrice = hasSale ? salePrice : price;
  const totalPrice = (currentUnitPrice * qty).toFixed(2);

  const reviews = product.reviews || [
    {
      name: 'Priya Sharma',
      date: '2 days ago',
      rating: 5,
      title: 'Flawless craftsmanship & fast dispatch!',
      comment: 'The stitching and zipper feel incredibly premium. Fits my 15-inch laptop with room to spare.'
    },
    {
      name: 'Rohan Mehta',
      date: '1 week ago',
      rating: 5,
      title: 'Exceeded all expectations',
      comment: 'Very practical everyday companion. Water-resistant material saved my gadgets in the rain.'
    },
    {
      name: 'Ananya Roy',
      date: '3 weeks ago',
      rating: 5,
      title: 'Minimalist & highly functional',
      comment: 'Subtle branding, gorgeous color, and extremely comfortable straps.'
    }
  ];
  const related = product.related_products || DEMO_PRODUCTS.filter(p => p.id !== product.id).slice(0, 4);

  const activeColorObj = (product.colors || []).find(c => c.name === selectedColor) || (product.colors && product.colors[0]);
  const currentStock = activeColorObj?.stock_quantity !== undefined
    ? activeColorObj.stock_quantity
    : (product.variants?.[0]?.stock_quantity !== undefined ? product.variants[0].stock_quantity : 50);
  const isOutOfStock = currentStock <= 0;

  const handleColorChange = (colorObj) => {
    if (!colorObj) return;
    const colorName = typeof colorObj === 'string' ? colorObj : colorObj.name;
    setSelectedColor(colorName);

    // Resolve target image for this selected color
    let targetImg = (typeof colorObj === 'object' && (colorObj.img || colorObj.image_url)) || null;

    if (!targetImg && product) {
      // 1. Try finding in product.colors by name (case-insensitive)
      const c = (product.colors || []).find(col => (col.name || '').trim().toLowerCase() === (colorName || '').trim().toLowerCase());
      if (c && (c.img || c.image_url)) targetImg = c.img || c.image_url;

      // 2. Try finding in product.variants by color_name
      if (!targetImg) {
        const v = (product.variants || []).find(variant => (variant.color_name || '').trim().toLowerCase() === (colorName || '').trim().toLowerCase() && variant.image_url);
        if (v && v.image_url) targetImg = v.image_url;
      }

      // 3. Try finding in product.images_detailed by color_name
      if (!targetImg) {
        const imgObj = (product.images_detailed || []).find(img => img.color_name && img.color_name.trim().toLowerCase() === (colorName || '').trim().toLowerCase());
        if (imgObj && imgObj.image_url) targetImg = imgObj.image_url;
      }

      // 4. Fallback to index in gallery
      if (!targetImg && product.colors) {
        const colIdx = product.colors.findIndex(col => (col.name || '').trim().toLowerCase() === (colorName || '').trim().toLowerCase());
        const gall = product.gallery || product.images || [];
        if (colIdx >= 0 && gall[colIdx]) {
          targetImg = gall[colIdx];
        }
      }
    }

    if (targetImg) {
      setActiveImage(targetImg);
    }
    setQty(1);
  };

  const handleThumbnailClick = (imgUrl) => {
    setActiveImage(imgUrl);
    if (!product) return;

    // Auto-select corresponding color if this thumbnail belongs to a color variant
    const matchedColor = (product.colors || []).find(c => (c.img === imgUrl || c.image_url === imgUrl));
    if (matchedColor && matchedColor.name) {
      setSelectedColor(matchedColor.name);
      return;
    }
    const matchedVariant = (product.variants || []).find(v => v.image_url === imgUrl);
    if (matchedVariant && matchedVariant.color_name) {
      setSelectedColor(matchedVariant.color_name);
      return;
    }
    const matchedDetail = (product.images_detailed || []).find(img => img.image_url === imgUrl && img.color_name);
    if (matchedDetail && matchedDetail.color_name) {
      setSelectedColor(matchedDetail.color_name);
      return;
    }
  };

  const handleAddToCart = () => {
    addToCart(product, {
      qty,
      size: selectedSize,
      color: selectedColor,
      image: activeImage
    });
  };

  const handleBuyNow = () => {
    addToCart(product, {
      qty,
      size: selectedSize,
      color: selectedColor,
      image: activeImage
    });
    router.push('/checkout');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: product.tagline || product.name,
        url: window.location.href
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  return (
    <div className="pdp-page">
      <div className="container">
        {/* Breadcrumb matching theme */}
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="breadcrumbs-sep" aria-hidden="true">/</span>
          <Link href="/shop">{product.category_name || product.cat || 'Collections'}</Link>
          <span className="breadcrumbs-sep" aria-hidden="true">/</span>
          <span className="breadcrumbs-current">{product.name}</span>
        </nav>

        {/* Main PDP Grid 1:1 with themedesign/product.html */}
        <div className="pdp-grid">
          {/* Gallery Column */}
          <div className="pdp-gallery">
            <div className="pdp-main-image-wrap">
              {product.badge && (
                <span className="pdp-badge">{product.badge}</span>
              )}

              {/* Floating Image Actions: Favourite & Share */}
              <div className="pdp-image-actions">
                <button
                  type="button"
                  className={`pdp-img-action-btn pdp-wish-btn ${inWish ? 'is-active' : ''}`}
                  onClick={() => toggleWishlist(product)}
                  aria-label="Add to wishlist"
                  title="Save to wishlist"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                  </svg>
                  <span className="pdp-img-tooltip">{inWish ? 'Saved' : 'Save'}</span>
                </button>
                <button
                  type="button"
                  className="pdp-img-action-btn pdp-share-btn"
                  onClick={handleShare}
                  aria-label="Share product"
                  title="Share product"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  <span className="pdp-img-tooltip">{copiedShare ? 'Copied!' : 'Share'}</span>
                </button>
              </div>

              <img
                className="pdp-main-image"
                id="pdp-main-img"
                src={activeImage}
                alt={product.name}
              />
            </div>

            {/* Thumbnails */}
            {gallery.length > 1 && (
              <div className="pdp-thumbs" role="tablist" aria-label="Product thumbnails">
                {gallery.map((imgUrl, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`pdp-thumb ${activeImage === imgUrl ? 'is-active' : ''}`}
                    onClick={() => handleThumbnailClick(imgUrl)}
                    aria-label={`View photo ${i + 1}`}
                  >
                    <img src={imgUrl} alt={`${product.name} preview ${i + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info & Purchase Column */}
          <div className="pdp-info">
            <div className="pdp-category">{product.category_name || product.cat || 'NP Grand'}</div>
            <h1 className="pdp-title">{product.name}</h1>

            <div className="pdp-rating-row">
              <div className="pdp-stars" aria-label={`Rating: ${product.rating || '4.9'} out of 5 stars`}>
                {[...Array(5)].map((_, i) => (
                  <svg key={i} viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                ))}
              </div>
              <span>{product.rating || '4.9'}</span>
              <span
                className="pdp-review-link"
                onClick={() => {
                  setActiveTab('reviews');
                  document.getElementById('pdp-tabs')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                ({reviews.length || product.reviews_count || 148} reviews)
              </span>
            </div>

            <div className="pdp-price-row">
              <span className="pdp-price">₹{currentUnitPrice.toFixed(2)}</span>
              {hasSale && <span className="pdp-sale-price">₹{price.toFixed(2)}</span>}
              {hasSale && (
                <span className="pdp-discount-badge">
                  Save {Math.round(((price - salePrice) / price) * 100)}%
                </span>
              )}
            </div>

            <p className="pdp-description">{product.description || product.tagline || ''}</p>

            {/* Colors */}
            {product.colors && product.colors.length > 0 && (
              <div className="pdp-option-block">
                <div className="pdp-option-title">
                  Colour: <span>{selectedColor}</span>
                </div>
                <div className="pdp-color-swatches">
                  {product.colors.map((c, i) => (
                    <button
                      key={c.name || i}
                      type="button"
                      className={`pdp-swatch ${selectedColor === c.name ? 'is-active' : ''}`}
                      style={{ backgroundColor: c.hex }}
                      onClick={() => handleColorChange(c)}
                      aria-label={c.name}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Sizes */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="pdp-option-block">
                <div className="pdp-option-title">
                  Size / Capacity: <span>{selectedSize}</span>
                </div>
                <div className="pdp-size-chips">
                  {product.sizes.map((s, i) => (
                    <button
                      key={s || i}
                      type="button"
                      className={`pdp-size-btn ${selectedSize === s ? 'is-active' : ''}`}
                      onClick={() => setSelectedSize(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="pdp-stock-status">
              <span
                className="pdp-stock-dot"
                style={{
                  backgroundColor: isOutOfStock ? '#ef4444' : currentStock <= 5 ? '#f59e0b' : '#10b981'
                }}
              ></span>
              <span style={{ color: isOutOfStock ? '#ef4444' : currentStock <= 5 ? '#b45309' : 'inherit' }}>
                {isOutOfStock
                  ? 'Out of stock in this colour — Check other colours or back soon'
                  : currentStock <= 5
                  ? `Low stock — Only ${currentStock} left in this colour!`
                  : `In stock (${currentStock} available) — Ready for prompt dispatch in 24 hours`}
              </span>
            </div>

            {/* Actions */}
            <div className="pdp-action-group">
              <div className="pdp-qty-row">
                <div className="pdp-qty-picker">
                  <button
                    type="button"
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    disabled={isOutOfStock}
                  >
                    −
                  </button>
                  <span>{isOutOfStock ? 0 : qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(q => Math.min(currentStock || 1, q + 1))}
                    aria-label="Increase quantity"
                    disabled={isOutOfStock || qty >= currentStock}
                  >
                    +
                  </button>
                </div>
                <button
                  className="btn pdp-add-btn"
                  onClick={handleAddToCart}
                  id="pdp-add-to-bag-btn"
                  disabled={isOutOfStock}
                  style={isOutOfStock ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  {isOutOfStock ? 'Sold out' : <>Add to bag — <span>₹{totalPrice}</span></>}
                </button>
              </div>
              <button
                className="btn pdp-buy-now-btn"
                onClick={handleBuyNow}
                id="pdp-buy-now-btn"
                disabled={isOutOfStock}
                style={isOutOfStock ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                {isOutOfStock ? 'Currently unavailable' : 'Instant checkout — Buy now ↗'}
              </button>
            </div>

            {/* Value Perks */}
            <div className="pdp-perks">
              <div className="pdp-perk-item">
                <strong>✦ Free Shipping</strong>
                <span>On all orders over ₹499</span>
              </div>
              <div className="pdp-perk-item">
                <strong>⌁ 30-Day Returns</strong>
                <span>Hassle-free exchange policy</span>
              </div>
              <div className="pdp-perk-item">
                <strong>♡ 2-Year Warranty</strong>
                <span>Crafted to last everyday wear</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs / Accordion for Details, Specs, Shipping, Reviews */}
        <section className="pdp-tabs-section reveal-on-scroll" id="pdp-tabs">
          <div className="pdp-tab-headers" role="tablist">
            <button
              className={`pdp-tab-btn ${activeTab === 'details' ? 'is-active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'details'}
              onClick={() => setActiveTab('details')}
            >
              Features & Dimensions
            </button>
            <button
              className={`pdp-tab-btn ${activeTab === 'materials' ? 'is-active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'materials'}
              onClick={() => setActiveTab('materials')}
            >
              Materials & Care
            </button>
            <button
              className={`pdp-tab-btn ${activeTab === 'shipping' ? 'is-active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'shipping'}
              onClick={() => setActiveTab('shipping')}
            >
              Delivery & Returns
            </button>
            <button
              className={`pdp-tab-btn ${activeTab === 'reviews' ? 'is-active' : ''}`}
              role="tab"
              aria-selected={activeTab === 'reviews'}
              onClick={() => setActiveTab('reviews')}
            >
              Customer Reviews ({reviews.length})
            </button>
          </div>

          <div className="pdp-tab-panels">
            {/* Details & Dimensions */}
            <div className={`pdp-tab-panel ${activeTab === 'details' ? 'is-active' : ''}`} role="tabpanel">
              <div className="pdp-specs-grid">
                <div>
                  <h3 style={{ fontSize: '20px', marginBottom: '14px' }}>Thoughtful Highlights</h3>
                  <ul className="pdp-specs-list">
                    {(product.features || [
                      'Padded 15" laptop compartment with quick-access side zip',
                      'High-density weather-resistant outer shell with TPU coating',
                      'Ergonomic reinforced shoulder harness and breathable mesh back panel',
                      'Internal organisation panel for stationery, passport, and cables'
                    ]).map((feat, i) => (
                      <li key={i}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', marginBottom: '14px' }}>Dimensions & Capacity</h3>
                  {(product.dimension_w || product.dimension_h || product.dimension_l) && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px', background: 'var(--surface-soft, #f8f9fa)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--line, #e5e7eb)' }}>
                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Width (W)</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>{product.dimension_w ? `${product.dimension_w} cm` : '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Height (H)</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>{product.dimension_h ? `${product.dimension_h} cm` : '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 600 }}>Length (L)</div>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--ink)' }}>{product.dimension_l ? `${product.dimension_l} cm` : '—'}</div>
                      </div>
                    </div>
                  )}
                  <p style={{ fontSize: '14px', lineHeight: '1.7', marginBottom: '16px' }}>
                    {product.dimensions || `${product.dimension_w || 30}cm × ${product.dimension_h || 44}cm × ${product.dimension_l || 14}cm | Everyday Carry`}
                  </p>
                  <div style={{ padding: '16px', background: 'var(--surface-soft)', border: '1px solid var(--line)', borderRadius: '8px', fontSize: '13px', lineHeight: '1.6' }}>
                    <strong>Everyday Carry Guarantee:</strong> Designed to maintain a streamlined profile while fully loaded. Tested for up to 25 lbs of daily carry.
                  </div>
                </div>
              </div>
            </div>

            {/* Materials & Care */}
            <div className={`pdp-tab-panel ${activeTab === 'materials' ? 'is-active' : ''}`} role="tabpanel">
              <div style={{ maxWidth: '760px' }}>
                <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Sustainable & Lasting Materials</h3>
                <p style={{ fontSize: '14.5px', lineHeight: '1.7', marginBottom: '20px' }}>
                  {product.materials || 'Crafted with 100% GOTS-certified heavyweight organic cotton canvas and vegetable-tanned full grain leather trims. Features custom matte gunmetal zinc alloy hardware and YKK® AquaGuard® weather-sealed zippers.'}
                </p>
                <h4 style={{ fontSize: '16px', marginBottom: '8px' }}>Care Instructions:</h4>
                <p style={{ fontSize: '13.5px', lineHeight: '1.7' }}>
                  Spot clean with warm water and mild organic detergent. Air dry in shade. Avoid machine washing or harsh chemical bleaches to preserve water-repellent coating and natural leather patina.
                </p>
              </div>
            </div>

            {/* Delivery & Returns */}
            <div className={`pdp-tab-panel ${activeTab === 'shipping' ? 'is-active' : ''}`} role="tabpanel">
              <div style={{ maxWidth: '760px' }}>
                <h3 style={{ fontSize: '20px', marginBottom: '12px' }}>Shipping Information</h3>
                <p style={{ fontSize: '14.5px', lineHeight: '1.7', marginBottom: '20px' }}>
                  {product.shipping_info || 'Free standard insured shipping across India on all orders over ₹499. Orders placed before 2:00 PM IST are dispatched on the same business day from our automated fulfillment hubs.'}
                </p>
                <h4 style={{ fontSize: '16px', marginBottom: '8px' }}>30-Day Easy Returns</h4>
                <p style={{ fontSize: '13.5px', lineHeight: '1.7' }}>
                  If you are not completely delighted with your purchase, return it unused in its original packaging within 30 days for a full refund or exchange. Prepaid return labels provided for all domestic orders.
                </p>
              </div>
            </div>

            {/* Customer Reviews */}
            <div className={`pdp-tab-panel ${activeTab === 'reviews' ? 'is-active' : ''}`} role="tabpanel">
              <div className="pdp-reviews-layout">
                <div className="pdp-rating-card">
                  <div>
                    <div className="pdp-score-large">{product.rating || '4.9'}</div>
                    <div className="pdp-stars" style={{ marginTop: '6px' }}>
                      {[...Array(5)].map((_, i) => (
                        <svg key={i} viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      ))}
                    </div>
                    <small style={{ color: 'var(--muted)', display: 'block', marginTop: '6px' }}>
                      Based on verified customer orders
                    </small>
                  </div>
                  <div className="pdp-bars">
                    <div className="pdp-bar-row"><span>5★</span><div className="pdp-bar-line"><div className="pdp-bar-fill" style={{ width: '92%' }}></div></div><span>92%</span></div>
                    <div className="pdp-bar-row"><span>4★</span><div className="pdp-bar-line"><div className="pdp-bar-fill" style={{ width: '8%' }}></div></div><span>8%</span></div>
                    <div className="pdp-bar-row"><span>3★</span><div className="pdp-bar-line"><div className="pdp-bar-fill" style={{ width: '0%' }}></div></div><span>0%</span></div>
                  </div>
                </div>

                <div className="pdp-reviews-list">
                  {reviews.map((r, i) => (
                    <div key={i} className="pdp-review-card">
                      <div className="pdp-review-header">
                        <span className="pdp-review-author">{r.user_name || r.name}</span>
                        <span className="pdp-review-date">{r.date_label || r.date || 'Verified buyer'}</span>
                      </div>
                      <div className="pdp-stars" style={{ marginBottom: '8px' }}>
                        {[...Array(Math.max(1, Math.min(5, Math.round(Number(r.rating) || 5))))].map((_, idx) => (
                          <svg key={idx} viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        ))}
                      </div>
                      <h4 className="pdp-review-title">{r.title}</h4>
                      <p className="pdp-review-comment">{r.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* You May Also Like Section */}
        {related && related.length > 0 && (
          <section className="section reveal-on-scroll" style={{ paddingTop: '56px' }}>
            <div className="section-heading">
              <div>
                <div className="eyebrow">Pair with perfection</div>
                <h2>You may also like</h2>
              </div>
              <Link className="text-link" href="/shop">
                View all collections <span>→</span>
              </Link>
            </div>
            <div className="product-grid grid-cols-4">
              {related.map((p, idx) => (
                <ProductCard product={p} index={idx} key={p.id} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Mobile Sticky Bottom Purchase Bar matching theme */}
      <aside className="pdp-mobile-sticky-bar">
        <div className="pdp-sticky-meta">
          <div className="pdp-sticky-name">{product.name}</div>
          <div className="pdp-sticky-price">₹{currentUnitPrice.toFixed(2)}</div>
        </div>
        <button className="btn" onClick={handleAddToCart} id="pdp-sticky-add-btn">
          Add to bag +
        </button>
      </aside>
    </div>
  );
}
