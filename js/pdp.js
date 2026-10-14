/**
 * Logic for Product Detail Page (product.html)
 */

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id') || 'the-everyday-tote';
  const product = window.getProductById(productId);

  if (!product) return;

  // Set Page Title & SEO Meta Tags
  document.title = `${product.name} — Everyday, Elevated | Your Brand`;

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    const descContent = `${product.name} (${product.cat}): ${product.tagline || product.description.slice(0, 140)} Price: ₹${product.price.toFixed(2)}. Free delivery on orders over ₹499.`;
    metaDesc.setAttribute('content', descContent);
  }

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', `${product.name} — Everyday, Elevated | Your Brand`);

  const ogDesc = document.querySelector('meta[property="og:description"]');
  if (ogDesc) ogDesc.setAttribute('content', product.tagline || product.description.slice(0, 150));

  const twitterTitle = document.querySelector('meta[name="twitter:title"]');
  if (twitterTitle) twitterTitle.setAttribute('content', `${product.name} — Everyday, Elevated | Your Brand`);

  const twitterDesc = document.querySelector('meta[name="twitter:description"]');
  if (twitterDesc) twitterDesc.setAttribute('content', product.tagline || product.description.slice(0, 150));

  const mainProdImg = (product.gallery && product.gallery[0]) || (product.colors && product.colors[0] && product.colors[0].img);
  if (mainProdImg) {
    const ogImg = document.querySelector('meta[property="og:image"]');
    if (ogImg) ogImg.setAttribute('content', mainProdImg);
    const twImg = document.querySelector('meta[name="twitter:image"]');
    if (twImg) twImg.setAttribute('content', mainProdImg);
  }

  // Elements
  const crumbTitle = document.getElementById('pdp-crumb-title');
  const mainImg = document.getElementById('pdp-main-img');
  const badge = document.getElementById('pdp-badge');
  const thumbsList = document.getElementById('pdp-thumbs-list');
  const categoryEl = document.getElementById('pdp-category');
  const titleEl = document.getElementById('pdp-title');
  const ratingText = document.getElementById('pdp-rating-text');
  const reviewCountLink = document.getElementById('pdp-reviews-count-link');
  const priceEl = document.getElementById('pdp-price');
  const salePriceEl = document.getElementById('pdp-sale-price');
  const discountBadge = document.getElementById('pdp-discount-badge');
  const descriptionEl = document.getElementById('pdp-description');
  const colorsList = document.getElementById('pdp-colors-list');
  const activeColorLabel = document.getElementById('pdp-active-color');
  const sizesList = document.getElementById('pdp-sizes-list');
  const activeSizeLabel = document.getElementById('pdp-active-size');
  const qtyMinus = document.getElementById('pdp-qty-minus');
  const qtyPlus = document.getElementById('pdp-qty-plus');
  const qtyDisplay = document.getElementById('pdp-qty-display');
  const addToBagBtn = document.getElementById('pdp-add-to-bag-btn');
  const btnPrice = document.getElementById('pdp-btn-price');
  const buyNowBtn = document.getElementById('pdp-buy-now-btn');
  const wishBtn = document.getElementById('pdp-wish-btn');
  const shareBtn = document.getElementById('pdp-share-btn');
  const featuresList = document.getElementById('pdp-features-list');
  const dimensionsEl = document.getElementById('pdp-dimensions');
  const materialsEl = document.getElementById('pdp-materials');
  const shippingEl = document.getElementById('pdp-shipping');
  const reviewsList = document.getElementById('pdp-reviews-list');
  const reviewScore = document.getElementById('pdp-review-score');
  const reviewsTabCount = document.getElementById('pdp-reviews-tab-count');
  const relatedGrid = document.getElementById('pdp-related-grid');
  const stickyBar = document.getElementById('pdp-sticky-bar');
  const stickyName = document.getElementById('pdp-sticky-name');
  const stickyPrice = document.getElementById('pdp-sticky-price');
  const stickyAddBtn = document.getElementById('pdp-sticky-add-btn');

  let currentQty = 1;
  let selectedColor = product.colors && product.colors[0] ? product.colors[0].name : '';
  let selectedSize = product.sizes && product.sizes[0] ? product.sizes[0] : 'Standard';

  // Populate basic info
  if (crumbTitle) crumbTitle.textContent = product.name;
  if (categoryEl) categoryEl.textContent = product.cat;
  if (titleEl) titleEl.textContent = product.name;
  if (ratingText) ratingText.textContent = product.rating || '4.9';
  if (reviewCountLink) reviewCountLink.textContent = `(${product.reviewCount || 148} reviews)`;
  if (priceEl) priceEl.textContent = `₹${product.price.toFixed(2)}`;
  if (btnPrice) btnPrice.textContent = `₹${product.price.toFixed(2)}`;
  if (descriptionEl) descriptionEl.textContent = product.description;

  // Sale price & discount
  if (product.sale && product.sale > product.price) {
    if (salePriceEl) {
      salePriceEl.textContent = `₹${product.sale.toFixed(2)}`;
      salePriceEl.style.display = 'inline';
    }
    if (discountBadge) {
      const discountPct = Math.round(((product.sale - product.price) / product.sale) * 100);
      discountBadge.textContent = `Save ${discountPct}%`;
      discountBadge.style.display = 'inline-block';
    }
  } else {
    if (salePriceEl) salePriceEl.style.display = 'none';
    if (discountBadge) discountBadge.style.display = 'none';
  }

  // Badge
  if (product.badge && badge) {
    badge.textContent = product.badge;
    badge.style.display = 'block';
  }

  // Gallery
  const images = (product.gallery && product.gallery.length) ? product.gallery : [
    'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1000&q=85'
  ];

  if (mainImg) {
    mainImg.src = images[0];
    mainImg.alt = product.name;
  }

  if (thumbsList) {
    thumbsList.innerHTML = images.map((imgUrl, i) => `
      <button type="button" class="pdp-thumb ${i === 0 ? 'is-active' : ''}" data-index="${i}" aria-label="View photo ${i + 1}">
        <img src="${imgUrl}" alt="${product.name} photo ${i + 1}">
      </button>
    `).join('');

    thumbsList.querySelectorAll('.pdp-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        thumbsList.querySelectorAll('.pdp-thumb').forEach(t => t.classList.remove('is-active'));
        thumb.classList.add('is-active');
        const idx = Number(thumb.dataset.index);
        mainImg.src = images[idx];
      });
    });
  }

  // Colors
  if (colorsList && product.colors) {
    activeColorLabel.textContent = selectedColor;
    colorsList.innerHTML = product.colors.map((c, i) => `
      <button type="button" class="pdp-swatch ${i === 0 ? 'is-active' : ''}" style="background-color: ${c.hex};" data-color="${c.name}" data-img="${c.img || ''}" aria-label="${c.name}" title="${c.name}"></button>
    `).join('');

    colorsList.querySelectorAll('.pdp-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        colorsList.querySelectorAll('.pdp-swatch').forEach(s => s.classList.remove('is-active'));
        swatch.classList.add('is-active');
        selectedColor = swatch.dataset.color;
        activeColorLabel.textContent = selectedColor;
        if (swatch.dataset.img && mainImg) {
          mainImg.src = swatch.dataset.img;
        }
      });
    });
  }

  // Sizes
  if (sizesList && product.sizes) {
    activeSizeLabel.textContent = selectedSize;
    sizesList.innerHTML = product.sizes.map((s, i) => `
      <button type="button" class="pdp-size-btn ${i === 0 ? 'is-active' : ''}" data-size="${s}">${s}</button>
    `).join('');

    sizesList.querySelectorAll('.pdp-size-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        sizesList.querySelectorAll('.pdp-size-btn').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        selectedSize = btn.dataset.size;
        activeSizeLabel.textContent = selectedSize;
      });
    });
  }

  // Quantity stepper
  const updateQty = (delta) => {
    currentQty = Math.max(1, currentQty + delta);
    if (qtyDisplay) qtyDisplay.textContent = currentQty;
    if (btnPrice) btnPrice.textContent = `₹${(product.price * currentQty).toFixed(2)}`;
  };
  if (qtyMinus) qtyMinus.addEventListener('click', () => updateQty(-1));
  if (qtyPlus) qtyPlus.addEventListener('click', () => updateQty(1));

  // Add to Bag action helper
  const handleAddToBag = () => {
    const item = {
      id: product.id,
      name: `${product.name} (${selectedColor || 'Standard'})`,
      price: product.price,
      image: mainImg ? mainImg.src : images[0],
      qty: currentQty,
      size: selectedSize
    };
    if (window.addToGlobalCart) {
      window.addToGlobalCart(item);
    }
  };

  if (addToBagBtn) addToBagBtn.addEventListener('click', handleAddToBag);

  // Buy Now action helper
  if (buyNowBtn) {
    buyNowBtn.addEventListener('click', () => {
      handleAddToBag();
      if (window.openGlobalCart) {
        window.openGlobalCart();
      }
    });
  }

  // Wishlist toggle (Floating image button)
  if (wishBtn) {
    wishBtn.addEventListener('click', () => {
      const isSaved = wishBtn.classList.toggle('is-active');
      wishBtn.setAttribute('aria-label', isSaved ? 'Remove from wishlist' : 'Add to wishlist');
      wishBtn.setAttribute('title', isSaved ? 'Remove from wishlist' : 'Save to wishlist');
      const tooltip = wishBtn.querySelector('.pdp-img-tooltip');
      if (tooltip) {
        tooltip.textContent = isSaved ? 'Saved' : 'Save';
      }
      if (window.showGlobalToast) {
        window.showGlobalToast(isSaved ? 'Saved to your wishlist' : 'Removed from your wishlist');
      }
    });
  }

  // Share button (Floating image button)
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const shareUrl = window.location.href;
      const shareData = {
        title: `${product.name} | Your Brand`,
        text: `Take a look at ${product.name} on Your Brand: ${product.tagline || product.name}`,
        url: shareUrl
      };

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          return;
        } catch (err) {
          if (err.name !== 'AbortError') {
            console.warn('Share error:', err);
          } else {
            return;
          }
        }
      }

      // Fallback: Copy link to clipboard
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(shareUrl);
        } else {
          const input = document.createElement('input');
          input.value = shareUrl;
          document.body.appendChild(input);
          input.select();
          document.execCommand('copy');
          document.body.removeChild(input);
        }
        if (window.showGlobalToast) {
          window.showGlobalToast('Product link copied to clipboard!');
        }
      } catch (err) {
        if (window.showGlobalToast) {
          window.showGlobalToast('Could not copy link');
        }
      }
    });
  }

  // Features, Specs & Materials
  if (featuresList && product.features) {
    featuresList.innerHTML = product.features.map(f => `
      <li>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span>${f}</span>
      </li>
    `).join('');
  }
  if (dimensionsEl) dimensionsEl.textContent = product.dimensions || '15" H x 12" W x 5" D';
  if (materialsEl) materialsEl.textContent = product.materials || 'Organic canvas with water-repellent coating.';
  if (shippingEl) shippingEl.textContent = product.shippingInfo || 'Free standard delivery over ₹499. Arrives in 2-4 business days.';

  // Reviews
  if (reviewsList && product.reviews) {
    if (reviewScore) reviewScore.textContent = product.rating || '4.9';
    if (reviewsTabCount) reviewsTabCount.textContent = product.reviews.length;
    reviewsList.innerHTML = product.reviews.map(r => `
      <article class="pdp-review-card">
        <div class="pdp-review-header">
          <span class="pdp-review-author">${r.name} · <small style="color:var(--brand-green-dark)">✓ Verified Buyer</small></span>
          <span class="pdp-review-date">${r.date}</span>
        </div>
        <div class="pdp-stars" style="margin-bottom:6px">
          <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        </div>
        <div class="pdp-review-title">${r.title}</div>
        <p class="pdp-review-comment">${r.comment}</p>
      </article>
    `).join('');
  }

  // Tabs switching
  const tabBtns = document.querySelectorAll('.pdp-tab-btn');
  const tabPanels = document.querySelectorAll('.pdp-tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      tabPanels.forEach(p => p.classList.remove('is-active'));

      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');
      const targetId = `tab-${btn.dataset.tab}`;
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('is-active');
    });
  });

  if (reviewCountLink) {
    reviewCountLink.addEventListener('click', () => {
      const reviewTabBtn = document.querySelector('[data-tab="reviews"]');
      if (reviewTabBtn) reviewTabBtn.click();
      document.querySelector('.pdp-tabs-section').scrollIntoView({ behavior: 'smooth' });
    });
  }

  // Related products
  if (relatedGrid && window.PRODUCT_CATALOG) {
    const others = window.PRODUCT_CATALOG.filter(p => p.id !== product.id).slice(0, 4);
    relatedGrid.innerHTML = others.map(p => {
      const img = p.gallery && p.gallery[0] ? p.gallery[0] : '';
      return `
        <article class="product-card stagger-item" data-product-id="${p.id}">
          <div class="product-card__image">
            <a href="product.html?id=${p.id}" class="product-card__img-link">
              <img src="${img}" alt="${p.name}" loading="lazy">
            </a>
            ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
            <div class="product-card__floating-actions">
              <button class="product-action-btn product-quickview-btn" aria-label="Quick view ${p.name}" data-quickview="${p.id}" title="Quick view">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                <span class="action-tooltip">Quick view</span>
              </button>
              <button class="product-action-btn product-wish" aria-label="Add ${p.name} to wishlist" data-wish data-product-id="${p.id}" title="Wishlist">♡</button>
            </div>
          </div>
          <div class="product-card__details">
            <div class="product-card__category">${p.cat}</div>
            <h3 class="product-card__title"><a href="product.html?id=${p.id}">${p.name}</a></h3>
            <div class="product-price">
              <span>₹${p.price.toFixed(2)}</span>
              ${p.sale ? `<del>₹${p.sale.toFixed(2)}</del>` : ''}
            </div>
            <button class="product-add" data-add-to-cart data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-image="${img}">Add to bag +</button>
          </div>
        </article>
      `;
    }).join('');
  }

  // Mobile Sticky Bottom Bar Scroll Observer
  if (stickyBar && addToBagBtn) {
    if (stickyName) stickyName.textContent = product.name;
    if (stickyPrice) stickyPrice.textContent = `₹${product.price.toFixed(2)}`;
    if (stickyAddBtn) stickyAddBtn.addEventListener('click', handleAddToBag);

    const observer = new IntersectionObserver(([entry]) => {
      // If main buy button has scrolled out of view upwards, show sticky bar
      if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
        stickyBar.classList.add('is-visible');
      } else {
        stickyBar.classList.remove('is-visible');
      }
    }, { threshold: 0.1 });

    observer.observe(addToBagBtn);
  }
});

