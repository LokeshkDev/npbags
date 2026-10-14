/**
 * Main Storefront Application Script
 * Controls cart, scroll reveals, Quick View popup modal, and global interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Cart Management with localStorage persistence
  let cart = [];
  try {
    const saved = localStorage.getItem('storefront_cart');
    if (saved) cart = JSON.parse(saved);
  } catch (e) {
    cart = [];
  }

  const saveCart = () => {
    try {
      localStorage.setItem('storefront_cart', JSON.stringify(cart));
    } catch (e) {}
  };

  const drawer = document.querySelector('cart-drawer');
  const panel = () => drawer ? drawer.querySelector('.cart-panel') : null;
  const overlay = () => drawer ? drawer.querySelector('.cart-overlay') : null;
  const toast = document.querySelector('.toast');
  let toastTimer;

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }

  function openCart() {
    if (!drawer) return;
    panel().classList.add('is-open');
    overlay().classList.add('is-open');
    document.body.classList.add('drawer-open');
    const closeBtn = drawer.querySelector('[data-cart-close]');
    if (closeBtn) closeBtn.focus();
  }

  function closeCart() {
    if (!drawer) return;
    panel().classList.remove('is-open');
    overlay().classList.remove('is-open');
    document.body.classList.remove('drawer-open');
  }

  function renderCart() {
    if (!drawer) return;
    const count = cart.reduce((sum, item) => sum + item.qty, 0);
    document.querySelectorAll('[data-cart-count]').forEach(el => el.textContent = count);
    
    const drawerCount = drawer.querySelector('[data-drawer-count]');
    if (drawerCount) drawerCount.textContent = `(${count})`;

    const drawerTotal = drawer.querySelector('[data-cart-total]');
    if (drawerTotal) {
      drawerTotal.textContent = `$${cart.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2)}`;
    }

    const list = drawer.querySelector('[data-cart-items]');
    if (!list) return;

    if (!cart.length) {
      list.innerHTML = '<div class="cart-empty">Your bag is waiting for something lovely.</div>';
      return;
    }

    list.innerHTML = cart.map((item, i) => `
      <div class="cart-line">
        <img src="${item.image}" alt="${item.name}">
        <div>
          <strong>${item.name}</strong>
          <small>$${item.price.toFixed(2)} ${item.size ? `· ${item.size}` : ''}</small>
          <div class="cart-line-actions">
            <button type="button" data-qty-minus="${i}" aria-label="Decrease quantity for ${item.name}">−</button>
            <span style="font-size:12px;font-weight:700">${item.qty}</span>
            <button type="button" data-qty-plus="${i}" aria-label="Increase quantity for ${item.name}">+</button>
          </div>
        </div>
        <strong>$${(item.price * item.qty).toFixed(2)}</strong>
      </div>
    `).join('');
  }

  // Global methods accessible by PDP or other components
  window.showGlobalToast = showToast;
  window.openGlobalCart = openCart;
  window.addToGlobalCart = function(item) {
    const existing = cart.find(p => p.name === item.name && (!item.size || p.size === item.size));
    if (existing) {
      existing.qty += item.qty || 1;
    } else {
      cart.push({ ...item, qty: item.qty || 1 });
    }
    saveCart();
    renderCart();
    showToast(`${item.name} added to your bag`);
  };

  // 2. Scroll Fade-in & Reveal Observer
  const initScrollReveal = () => {
    const revealElements = document.querySelectorAll('.reveal-on-scroll');
    if (!('IntersectionObserver' in window)) {
      revealElements.forEach(el => el.classList.add('is-revealed'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -40px 0px',
      threshold: 0.12
    });

    revealElements.forEach(el => observer.observe(el));
  };
  initScrollReveal();

  // 3. Quick View Modal System
  const qvModal = document.querySelector('quick-view-modal');
  const qvOverlay = qvModal ? qvModal.querySelector('.quickview-overlay') : null;
  const qvDialog = qvModal ? qvModal.querySelector('.quickview-dialog') : null;
  const qvBody = qvModal ? qvModal.querySelector('[data-quickview-body]') : null;

  function openQuickView(productId) {
    if (!window.getProductById || !qvModal) return;
    const p = window.getProductById(productId);
    if (!p) return;

    let selectedImg = (p.gallery && p.gallery[0]) ? p.gallery[0] : '';
    let selectedColor = p.colors && p.colors[0] ? p.colors[0].name : '';
    let selectedSize = p.sizes && p.sizes[0] ? p.sizes[0] : 'One Size';
    let qty = 1;

    const discountPill = (p.sale && p.sale > p.price)
      ? `<span class="qv-badge-sale">Save ${Math.round(((p.sale - p.price) / p.sale) * 100)}%</span>`
      : '';

    qvBody.innerHTML = `
      <div class="qv-grid">
        <div class="qv-gallery">
          <div class="qv-image-main">
            <img id="qv-main-img" src="${selectedImg}" alt="${p.name}">
          </div>
          <div class="qv-thumbs">
            ${(p.gallery || [selectedImg]).map((imgUrl, i) => `
              <button type="button" class="qv-thumb ${i === 0 ? 'is-active' : ''}" data-idx="${i}" aria-label="View photo ${i + 1}">
                <img src="${imgUrl}" alt="${p.name} preview ${i + 1}">
              </button>
            `).join('')}
          </div>
        </div>

        <div class="qv-details">
          <div>
            <div class="qv-eyebrow">${p.cat}</div>
            <h2 class="qv-title">${p.name}</h2>
          </div>

          <div class="qv-rating">
            <div class="qv-stars">
              <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </div>
            <span>${p.rating || '4.9'} (${p.reviewCount || 148} reviews)</span>
          </div>

          <div class="qv-price-wrap">
            <span class="qv-price">$${p.price.toFixed(2)}</span>
            ${p.sale ? `<span class="qv-price-del">$${p.sale.toFixed(2)}</span>` : ''}
            ${discountPill}
          </div>

          <p class="qv-description">${p.tagline || p.description}</p>

          ${p.colors ? `
            <div class="qv-option-group">
              <div class="qv-option-label">Colour: <span id="qv-active-color-txt">${selectedColor}</span></div>
              <div class="qv-colors" id="qv-swatches">
                ${p.colors.map((c, i) => `
                  <button type="button" class="qv-color-swatch ${i === 0 ? 'is-active' : ''}" style="background-color:${c.hex}" data-color="${c.name}" data-img="${c.img || ''}" aria-label="${c.name}"></button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${p.sizes ? `
            <div class="qv-option-group">
              <div class="qv-option-label">Size: <span id="qv-active-size-txt">${selectedSize}</span></div>
              <div class="qv-sizes" id="qv-size-chips">
                ${p.sizes.map((s, i) => `
                  <button type="button" class="qv-size-chip ${i === 0 ? 'is-active' : ''}" data-size="${s}">${s}</button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <div class="qv-actions-row">
            <div class="qv-qty">
              <button type="button" id="qv-minus" aria-label="Decrease quantity">−</button>
              <span id="qv-qty-txt">${qty}</span>
              <button type="button" id="qv-plus" aria-label="Increase quantity">+</button>
            </div>
            <button class="btn btn--full" id="qv-add-btn">Add to bag +</button>
          </div>

          <a href="product.html?id=${p.id}" class="qv-pdp-link">
            <span>View full product details & reviews</span>
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    `;

    // Hook internal events in modal
    const mainImgEl = qvBody.querySelector('#qv-main-img');
    const colorTxt = qvBody.querySelector('#qv-active-color-txt');
    const sizeTxt = qvBody.querySelector('#qv-active-size-txt');
    const qtyTxt = qvBody.querySelector('#qv-qty-txt');

    // Thumbs
    qvBody.querySelectorAll('.qv-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        qvBody.querySelectorAll('.qv-thumb').forEach(t => t.classList.remove('is-active'));
        thumb.classList.add('is-active');
        const idx = Number(thumb.dataset.idx);
        if (p.gallery && p.gallery[idx]) {
          mainImgEl.src = p.gallery[idx];
        }
      });
    });

    // Swatches
    qvBody.querySelectorAll('.qv-color-swatch').forEach(swatch => {
      swatch.addEventListener('click', () => {
        qvBody.querySelectorAll('.qv-color-swatch').forEach(s => s.classList.remove('is-active'));
        swatch.classList.add('is-active');
        selectedColor = swatch.dataset.color;
        if (colorTxt) colorTxt.textContent = selectedColor;
        if (swatch.dataset.img) {
          mainImgEl.src = swatch.dataset.img;
        }
      });
    });

    // Sizes
    qvBody.querySelectorAll('.qv-size-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        qvBody.querySelectorAll('.qv-size-chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        selectedSize = chip.dataset.size;
        if (sizeTxt) sizeTxt.textContent = selectedSize;
      });
    });

    // Stepper
    qvBody.querySelector('#qv-minus').addEventListener('click', () => {
      qty = Math.max(1, qty - 1);
      qtyTxt.textContent = qty;
    });
    qvBody.querySelector('#qv-plus').addEventListener('click', () => {
      qty += 1;
      qtyTxt.textContent = qty;
    });

    // Add to bag
    qvBody.querySelector('#qv-add-btn').addEventListener('click', () => {
      window.addToGlobalCart({
        id: p.id,
        name: `${p.name} (${selectedColor || 'Standard'})`,
        price: p.price,
        image: mainImgEl.src || selectedImg,
        qty: qty,
        size: selectedSize
      });
      closeQuickView();
    });

    qvOverlay.classList.add('is-open');
    qvDialog.classList.add('is-open');
    document.body.classList.add('modal-open');
  }

  function closeQuickView() {
    if (!qvModal) return;
    qvOverlay.classList.remove('is-open');
    qvDialog.classList.remove('is-open');
    document.body.classList.remove('modal-open');
  }

  // 4. Global Event Delegation
  document.addEventListener('click', (event) => {
    // Quick View trigger
    const qvBtn = event.target.closest('[data-quickview]');
    if (qvBtn) {
      event.preventDefault();
      openQuickView(qvBtn.dataset.quickview);
      return;
    }

    // Quick View close
    if (event.target.closest('[data-quickview-close]')) {
      closeQuickView();
      return;
    }

    // Add to Cart button on product card
    const add = event.target.closest('[data-add-to-cart]');
    if (add) {
      const item = {
        id: add.dataset.id || 'item',
        name: add.dataset.name,
        price: Number(add.dataset.price),
        image: add.dataset.image,
        qty: 1
      };
      window.addToGlobalCart(item);
      return;
    }

    // Cart open / close
    if (event.target.closest('[data-cart-open]')) openCart();
    if (event.target.closest('[data-cart-close]')) closeCart();

    // Search dialog
    if (event.target.closest('[data-search]')) {
      const query = window.prompt('What are you looking for? (e.g. tote, travel, crossbody)');
      if (query && query.trim()) {
        const cleaned = query.trim().toLowerCase();
        // check if on page
        const found = [...document.querySelectorAll('.product-card')].find(card => card.innerText.toLowerCase().includes(cleaned));
        if (found) {
          found.scrollIntoView({ behavior: 'smooth', block: 'center' });
          found.style.outline = '3px solid var(--brand-red)';
          setTimeout(() => found.style.outline = '', 2500);
        } else {
          showToast(`No matches for “${query.trim()}”. Discover our featured new arrivals below.`);
        }
      }
    }

    // Account modal / demo toast
    if (event.target.closest('[data-account]')) {
      showToast('Customer account & orders dashboard ready for backend sync.');
    }

    // Wishlist view trigger
    if (event.target.closest('[data-wishlist-view]')) {
      showToast('Your saved wishlist items are synced to this device.');
    }

    // Cart Quantity +/-
    const plus = event.target.closest('[data-qty-plus]');
    const minus = event.target.closest('[data-qty-minus]');
    if (plus) {
      cart[Number(plus.dataset.qtyPlus)].qty++;
      saveCart();
      renderCart();
    }
    if (minus) {
      const i = Number(minus.dataset.qtyMinus);
      cart[i].qty--;
      if (cart[i].qty <= 0) cart.splice(i, 1);
      saveCart();
      renderCart();
    }

    // Checkout demo
    if (event.target.closest('[data-checkout]')) {
      showToast('Checkout demo ready: Integrates with Backend.');
    }

    // Wishlist heart button
    const wish = event.target.closest('[data-wish]');
    if (wish) {
      const isSaved = wish.textContent.trim() === '♥';
      wish.textContent = isSaved ? '♡' : '♥';
      wish.style.color = isSaved ? '' : 'var(--brand-red)';
      showToast(isSaved ? 'Removed from wishlist' : 'Added to wishlist');
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeCart();
      closeQuickView();
    }
  });

  // Newsletter form handler
  document.addEventListener('submit', (event) => {
    if (event.target.matches('[data-newsletter]')) {
      event.preventDefault();
      const input = event.target.querySelector('input');
      if (input && input.value.trim()) {
        showToast('Welcome to the community! Check your inbox for a 10% welcome gift.');
        event.target.reset();
      }
    }
  });

  // Dynamic Year in footer
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

  // Initial cart render
  renderCart();
});