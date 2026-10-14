/**
 * Collections / Shop Page Controller
 * Manages category/price/color/badge filtering, sorting, and dynamic grid levels (3, 4, 6, table).
 */

document.addEventListener('DOMContentLoaded', () => {
  const catalog = window.PRODUCT_CATALOG || [];
  const gridContainer = document.getElementById('shop-products-grid');
  const countDisplay = document.getElementById('product-count');
  const activeTagsContainer = document.getElementById('active-filters-bar');
  const sortSelect = document.getElementById('sort-by-select');
  const resetFiltersBtn = document.getElementById('btn-reset-filters');
  const mobileSidebar = document.getElementById('shop-sidebar');
  const mobileBackdrop = document.getElementById('sidebar-backdrop');
  const openMobileFilterBtn = document.getElementById('btn-open-mobile-filter');
  const closeMobileFilterBtn = document.getElementById('btn-close-mobile-filter');

  // Parse initial URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const initialCategory = urlParams.get('category') || 'all';
  const initialFilter = urlParams.get('filter') || 'all';
  const initialGrid = urlParams.get('grid') || '4';

  const state = {
    category: initialCategory,
    priceRange: 'all',
    availability: initialFilter === 'new' ? 'new' : 'all',
    color: 'all',
    sortBy: 'featured',
    gridLevel: initialGrid // '3', '4', '6', 'table'
  };

  // Helper to filter & sort products
  function getFilteredProducts() {
    let result = [...catalog];

    // 1. Category Filter
    if (state.category !== 'all') {
      result = result.filter(p => p.cat.toLowerCase() === state.category.toLowerCase());
    }

    // 2. Price Filter
    if (state.priceRange === 'under-40') {
      result = result.filter(p => p.price < 40);
    } else if (state.priceRange === '40-60') {
      result = result.filter(p => p.price >= 40 && p.price <= 60);
    } else if (state.priceRange === 'over-60') {
      result = result.filter(p => p.price > 60);
    }

    // 3. Availability & Badge Filter
    if (state.availability === 'sale') {
      result = result.filter(p => p.sale && p.sale > p.price);
    } else if (state.availability === 'bestseller') {
      result = result.filter(p => p.badge && p.badge.toLowerCase().includes('bestseller'));
    } else if (state.availability === 'new') {
      result = result.filter(p => p.badge && p.badge.toLowerCase().includes('new'));
    }

    // 4. Color Filter
    if (state.color !== 'all') {
      result = result.filter(p => p.colors && p.colors.some(c => c.name.toLowerCase() === state.color.toLowerCase()));
    }

    // 5. Sorting
    if (state.sortBy === 'price-low') {
      result.sort((a, b) => a.price - b.price);
    } else if (state.sortBy === 'price-high') {
      result.sort((a, b) => b.price - a.price);
    } else if (state.sortBy === 'rating') {
      result.sort((a, b) => (b.rating || 5) - (a.rating || 5));
    } else if (state.sortBy === 'newest') {
      result.sort((a, b) => (b.badge === 'New' ? 1 : 0) - (a.badge === 'New' ? 1 : 0));
    }

    return result;
  }

  // Render products into grid or table
  function renderProducts() {
    if (!gridContainer) return;

    const filtered = getFilteredProducts();
    if (countDisplay) countDisplay.textContent = filtered.length;

    renderActiveTags();

    // Reset container classes based on gridLevel
    gridContainer.className = 'shop-grid';
    if (state.gridLevel === 'table') {
      gridContainer.classList.add('grid-table');
    } else {
      gridContainer.classList.add(`grid-cols-${state.gridLevel}`);
    }

    if (filtered.length === 0) {
      gridContainer.innerHTML = `
        <div class="shop-empty-state" style="grid-column: 1 / -1; width: 100%;">
          <h3>No matching pieces found</h3>
          <p>Try loosening your filter selections or explore our complete catalog.</p>
          <button class="btn" id="empty-reset-btn" type="button">Reset All Filters</button>
        </div>
      `;
      const emptyBtn = document.getElementById('empty-reset-btn');
      if (emptyBtn) emptyBtn.addEventListener('click', resetAllFilters);
      return;
    }

    // Render Table Format
    if (state.gridLevel === 'table') {
      let tableHtml = `
        <div class="table-head-row">
          <span>Product</span>
          <span>Details</span>
          <span>Rating</span>
          <span>Price</span>
          <span class="table-col-stock">Status</span>
          <span style="text-align:right">Action</span>
        </div>
      `;

      tableHtml += filtered.map(p => {
        const img = p.gallery && p.gallery[0] ? p.gallery[0] : '';
        return `
          <article class="product-table-row" data-product-id="${p.id}">
            <div class="table-col-img">
              <a href="product.html?id=${p.id}" aria-label="View ${p.name}">
                <img src="${img}" alt="${p.name}" loading="lazy">
              </a>
            </div>
            <div class="table-col-info">
              <div class="table-col-cat">${p.cat}</div>
              <h3><a href="product.html?id=${p.id}">${p.name}</a></h3>
            </div>
            <div class="table-col-rating">
              <svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span>${p.rating || '4.9'}</span>
            </div>
            <div class="table-col-price">
              <span>₹${p.price.toFixed(2)}</span>
              ${p.sale ? `<del>₹${p.sale.toFixed(2)}</del>` : ''}
            </div>
            <div class="table-col-stock">
              <span class="dot"></span>
              <span>In stock</span>
            </div>
            <div class="table-col-actions">
              <button class="btn-qv" aria-label="Quick view ${p.name}" data-quickview="${p.id}" title="Quick view">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="btn btn-add" data-add-to-cart data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-image="${img}">
                Add to bag +
              </button>
            </div>
          </article>
        `;
      }).join('');

      gridContainer.innerHTML = tableHtml;
      return;
    }

    // Render Grid Cards (3, 4, 6)
    gridContainer.innerHTML = filtered.map(p => {
      const img = p.gallery && p.gallery[0] ? p.gallery[0] : '';
      return `
        <article class="product-card product-card--shop" data-product-id="${p.id}">
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

  // Render active filter tag pills
  function renderActiveTags() {
    if (!activeTagsContainer) return;
    const tags = [];

    if (state.category !== 'all') {
      tags.push({ label: `Category: ${state.category}`, key: 'category' });
    }
    if (state.priceRange !== 'all') {
      const priceLabels = { 'under-40': 'Under ₹40', '40-60': '₹40 – ₹60', 'over-60': 'Over ₹60' };
      tags.push({ label: priceLabels[state.priceRange], key: 'priceRange' });
    }
    if (state.availability !== 'all') {
      const availLabels = { 'sale': 'On Sale', 'bestseller': 'Bestseller', 'new': 'New Arrival' };
      tags.push({ label: availLabels[state.availability], key: 'availability' });
    }
    if (state.color !== 'all') {
      tags.push({ label: `Color: ${state.color}`, key: 'color' });
    }

    if (tags.length === 0) {
      activeTagsContainer.innerHTML = '';
      return;
    }

    activeTagsContainer.innerHTML = tags.map(t => `
      <span class="active-filter-tag">
        <span>${t.label}</span>
        <button type="button" data-remove-filter="${t.key}" aria-label="Remove filter">✕</button>
      </span>
    `).join('');

    activeTagsContainer.querySelectorAll('[data-remove-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.removeFilter;
        state[key] = 'all';
        syncSidebarControls();
        renderProducts();
      });
    });
  }

  // Reset all filters
  function resetAllFilters() {
    state.category = 'all';
    state.priceRange = 'all';
    state.availability = 'all';
    state.color = 'all';
    state.sortBy = 'featured';
    if (sortSelect) sortSelect.value = 'featured';
    syncSidebarControls();
    renderProducts();
  }

  // Sync sidebar radio / chips with current state
  function syncSidebarControls() {
    // Categories
    document.querySelectorAll('input[name="category-filter"]').forEach(radio => {
      radio.checked = radio.value.toLowerCase() === state.category.toLowerCase();
    });

    // Price chips
    document.querySelectorAll('.price-chip').forEach(chip => {
      chip.classList.toggle('is-active', chip.dataset.price === state.priceRange);
    });

    // Availability
    document.querySelectorAll('input[name="avail-filter"]').forEach(radio => {
      radio.checked = radio.value === state.availability;
    });

    // Color swatches
    document.querySelectorAll('.color-swatch-filter-btn').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.color.toLowerCase() === state.color.toLowerCase());
    });
  }

  // Bind Sidebar Events
  // 1. Categories
  document.querySelectorAll('input[name="category-filter"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.category = radio.value;
      renderProducts();
    });
  });

  // 2. Price Chips
  document.querySelectorAll('.price-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.priceRange = chip.dataset.price;
      syncSidebarControls();
      renderProducts();
    });
  });

  // 3. Availability
  document.querySelectorAll('input[name="avail-filter"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.availability = radio.value;
      renderProducts();
    });
  });

  // 4. Color Swatches
  document.querySelectorAll('.color-swatch-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.color = (state.color === btn.dataset.color) ? 'all' : btn.dataset.color;
      syncSidebarControls();
      renderProducts();
    });
  });

  // 5. Sort Selector
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      state.sortBy = sortSelect.value;
      renderProducts();
    });
  }

  // 6. Reset Filters
  if (resetFiltersBtn) {
    resetFiltersBtn.addEventListener('click', resetAllFilters);
  }

  // 7. Grid Level Switcher Buttons (3, 4, 6, table)
  const gridBtns = document.querySelectorAll('.btn-grid-opt');
  gridBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      gridBtns.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      state.gridLevel = btn.dataset.grid;
      renderProducts();
    });
  });

  // Mobile Filter Drawer Handlers
  const openMobileFilter = () => {
    if (mobileSidebar && mobileBackdrop) {
      mobileSidebar.classList.add('is-open');
      mobileBackdrop.classList.add('is-open');
      document.body.classList.add('drawer-open');
    }
  };

  const closeMobileFilter = () => {
    if (mobileSidebar && mobileBackdrop) {
      mobileSidebar.classList.remove('is-open');
      mobileBackdrop.classList.remove('is-open');
      document.body.classList.remove('drawer-open');
    }
  };

  if (openMobileFilterBtn) openMobileFilterBtn.addEventListener('click', openMobileFilter);
  if (closeMobileFilterBtn) closeMobileFilterBtn.addEventListener('click', closeMobileFilter);
  if (mobileBackdrop) mobileBackdrop.addEventListener('click', closeMobileFilter);

  // Initialize controls and render
  syncSidebarControls();
  renderProducts();
});
