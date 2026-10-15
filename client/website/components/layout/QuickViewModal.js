'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Icon } from '../common/Icons';
import { useQuickView } from '../../lib/quickview-context';
import { useCart } from '../../lib/cart-context';
import { useWishlist } from '../../lib/wishlist-context';

export function QuickViewModal() {
  const { selectedProduct: product, closeQuickView } = useQuickView();
  const { addToCart } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const [activeImage, setActiveImage] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (product) {
      const firstColor = product.colors && product.colors[0];
      const firstColorImg = (firstColor && (firstColor.img || firstColor.image_url)) || null;
      const defaultImg = firstColorImg || product.primary_image || (product.gallery && product.gallery[0]) || (product.images && product.images[0]) || '';
      setActiveImage(defaultImg);
      setSelectedColor(firstColor ? firstColor.name : '');
      setSelectedSize(product.sizes && product.sizes[0] ? product.sizes[0] : 'Standard');
      setQty(1);
    }
  }, [product]);

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

    if (product?.primary_image) addImg(product.primary_image);
    (product?.colors || []).forEach(c => addImg(c?.img || c?.image_url));
    (product?.variants || []).forEach(v => addImg(v?.image_url));
    (product?.gallery || []).forEach(addImg);
    (product?.images || []).forEach(addImg);
    (product?.images_detailed || []).forEach(i => addImg(i?.image_url));
    if (activeImage) addImg(activeImage);

    return list;
  }, [product, activeImage]);

  const inWish = isInWishlist(product?.id);

  if (!product) return null;

  const price = typeof product.price === 'number' ? product.price : parseFloat(product.price || 0);
  const salePrice = typeof product.sale_price === 'number' ? product.sale_price : parseFloat(product.sale_price || 0);
  const hasSale = salePrice > 0 && salePrice < price;

  const activeColorObj = (product.colors || []).find(c => c.name === selectedColor) || (product.colors && product.colors[0]);
  const currentStock = activeColorObj?.stock_quantity !== undefined
    ? activeColorObj.stock_quantity
    : (product.variants?.[0]?.stock_quantity !== undefined ? product.variants[0].stock_quantity : 50);
  const isOutOfStock = currentStock <= 0;

  const handleColorChange = (colorObj) => {
    if (!colorObj) return;
    const colorName = typeof colorObj === 'string' ? colorObj : colorObj.name;
    setSelectedColor(colorName);

    let targetImg = (typeof colorObj === 'object' && (colorObj.img || colorObj.image_url)) || null;

    if (!targetImg && product) {
      const c = (product.colors || []).find(col => (col.name || '').trim().toLowerCase() === (colorName || '').trim().toLowerCase());
      if (c && (c.img || c.image_url)) targetImg = c.img || c.image_url;

      if (!targetImg) {
        const v = (product.variants || []).find(variant => (variant.color_name || '').trim().toLowerCase() === (colorName || '').trim().toLowerCase() && variant.image_url);
        if (v && v.image_url) targetImg = v.image_url;
      }

      if (!targetImg) {
        const imgObj = (product.images_detailed || []).find(img => img.color_name && img.color_name.trim().toLowerCase() === (colorName || '').trim().toLowerCase());
        if (imgObj && imgObj.image_url) targetImg = imgObj.image_url;
      }

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

  const handleAdd = () => {
    if (isOutOfStock) return;
    addToCart(product, {
      qty,
      size: selectedSize,
      color: selectedColor,
      image: activeImage
    });
    closeQuickView();
  };

  return (
    <>
      <div className="quickview-overlay is-open" onClick={closeQuickView} />
      <div className="quickview-dialog is-open" role="dialog" aria-modal="true" aria-label="Quick product preview">
        <div className="quickview-handle" aria-hidden="true" />
        <button
          className="quickview-close"
          onClick={closeQuickView}
          aria-label="Close quick view"
          title="Close"
        >
          <Icon name="close" size={20} />
        </button>

        <div className="quickview-body">
          <div className="qv-grid">
            <div className="qv-gallery">
              <div className="qv-image-main">
                <img id="qv-main-img" src={activeImage} alt={product.name} />
              </div>
              {gallery.length > 1 && (
                <div className="qv-thumbs">
                  {gallery.map((imgUrl, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`qv-thumb ${activeImage === imgUrl ? 'is-active' : ''}`}
                      onClick={() => handleThumbnailClick(imgUrl)}
                      aria-label={`View photo ${i + 1}`}
                    >
                      <img src={imgUrl} alt={`${product.name} preview ${i + 1}`} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="qv-details">
              <div>
                <div className="qv-eyebrow">{product.category_name || product.cat || 'NP Grand'}</div>
                <h2 className="qv-title">{product.name}</h2>
              </div>

              <div className="qv-rating">
                <div className="qv-stars">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  ))}
                </div>
                <span>{product.rating || '4.9'} ({product.reviewCount || product.reviews_count || 148} reviews)</span>
              </div>

              <div className="qv-price-wrap">
                <span className="qv-price">₹{(hasSale ? salePrice : price).toFixed(2)}</span>
                {hasSale && <span className="qv-price-del">₹{price.toFixed(2)}</span>}
                {hasSale && <span className="qv-badge-sale">SAVE {Math.round(((price - salePrice) / price) * 100)}%</span>}
              </div>

              <p className="qv-description">{product.tagline || product.description || ''}</p>

              {product.colors && product.colors.length > 0 && (
                <div className="qv-option-group">
                  <div className="qv-option-label">
                    Colour: <span id="qv-active-color-txt">{selectedColor}</span>
                  </div>
                  <div className="qv-colors" id="qv-swatches">
                    {product.colors.map((c, i) => (
                      <button
                        key={c.name || i}
                        type="button"
                        className={`qv-color-swatch ${selectedColor === c.name ? 'is-active' : ''}`}
                        style={{ backgroundColor: c.hex }}
                        onClick={() => handleColorChange(c)}
                        aria-label={c.name}
                      />
                    ))}
                  </div>
                </div>
              )}

              {product.sizes && product.sizes.length > 0 && (
                <div className="qv-option-group">
                  <div className="qv-option-label">
                    Size: <span id="qv-active-size-txt">{selectedSize}</span>
                  </div>
                  <div className="qv-sizes" id="qv-size-chips">
                    {product.sizes.map((s, i) => (
                      <button
                        key={s || i}
                        type="button"
                        className={`qv-size-chip ${selectedSize === s ? 'is-active' : ''}`}
                        onClick={() => setSelectedSize(s)}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', margin: '4px 0 12px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: isOutOfStock ? '#ef4444' : currentStock <= 5 ? '#f59e0b' : '#10b981',
                    display: 'inline-block'
                  }}
                />
                <span style={{ color: isOutOfStock ? '#ef4444' : currentStock <= 5 ? '#b45309' : 'var(--muted)' }}>
                  {isOutOfStock
                    ? 'Out of stock'
                    : currentStock <= 5
                    ? `Only ${currentStock} left in stock!`
                    : `In stock (${currentStock} available)`}
                </span>
              </div>

              <div className="qv-actions-row">
                <div className="qv-qty">
                  <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Decrease quantity" disabled={isOutOfStock}>−</button>
                  <span id="qv-qty-txt">{isOutOfStock ? 0 : qty}</span>
                  <button type="button" onClick={() => setQty(q => Math.min(currentStock || 1, q + 1))} aria-label="Increase quantity" disabled={isOutOfStock || qty >= currentStock}>+</button>
                </div>
                <button
                  className="btn btn--full"
                  onClick={handleAdd}
                  id="qv-add-btn"
                  disabled={isOutOfStock}
                  style={isOutOfStock ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
                >
                  {isOutOfStock ? 'Sold out' : 'Add to bag +'}
                </button>
              </div>

              <Link href={`/product/${product.slug || product.id}`} className="qv-pdp-link" onClick={closeQuickView}>
                <span>View full product details & reviews</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

