const icon = (name) => {
  const paths = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    bag: '<path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    chevronLeft: '<path d="m15 18-6-6 6-6"/>',
    chevronRight: '<path d="m9 18 6-6-6-6"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    check: '<polyline points="20 6 9 17 4 12"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ''}</svg>`;
};

class SiteAnnouncement extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="announcement">
        <div class="announcement__inner">
          <span>Complimentary delivery on qualifying orders over $50</span>
          <span aria-hidden="true" class="announcement__star">✦</span>
          <span><strong>Fresh picks.</strong> Thoughtful details.</span>
        </div>
      </div>`;
  }
}

class SiteHeader extends HTMLElement {
  connectedCallback() {
    const isPdp = window.location.pathname.includes('product.html');
    const homeHref = isPdp ? 'index.html' : '#';
    const catHref = isPdp ? 'index.html#categories' : '#categories';
    const arrivalsHref = isPdp ? 'index.html#new-arrivals' : '#new-arrivals';
    const storyHref = isPdp ? 'index.html#story' : '#story';
    const benefitsHref = isPdp ? 'index.html#benefits' : '#benefits';

    this.innerHTML = `
      <header class="site-header">
        <div class="container header-inner">
          <button class="icon-button mobile-menu" aria-label="Open navigation" aria-expanded="false">${icon('menu')}</button>
          <a href="${homeHref}" class="brand" aria-label="Your Brand home">
            <img class="brand-logo" src="assets/brand-logo.png" alt="Your Brand logo">
          </a>
          <nav class="nav" aria-label="Main navigation">
            <a href="${catHref}">Collections</a>
            <a href="${arrivalsHref}">New arrivals</a>
            <a href="${storyHref}">Our story</a>
            <a href="${benefitsHref}">Why us</a>
          </nav>
          <div class="header-actions">
            <button class="icon-button" aria-label="Search" data-search>${icon('search')}</button>
            <button class="icon-button desktop-account" aria-label="Wishlist" data-wishlist-view title="Saved items">${icon('heart')}</button>
            <button class="icon-button desktop-account" aria-label="Account" data-account>${icon('user')}</button>
            <button class="icon-button" aria-label="Shopping bag" data-cart-open>
              ${icon('bag')}
              <span class="cart-count" data-cart-count>0</span>
            </button>
          </div>
        </div>
        <nav class="mobile-nav" aria-label="Mobile navigation">
          <a href="${catHref}">Collections</a>
          <a href="${arrivalsHref}">New arrivals</a>
          <a href="${storyHref}">Our story</a>
          <a href="${benefitsHref}">Why us</a>
        </nav>
      </header>`;

    const toggle = this.querySelector('.mobile-menu');
    if (toggle) {
      toggle.addEventListener('click', () => {
        const nav = this.querySelector('.mobile-nav');
        const open = nav.classList.toggle('is-open');
        toggle.setAttribute('aria-expanded', String(open));
      });
    }
  }
}

class HeroBanner extends HTMLElement {
  connectedCallback() {
    const slides = [
      {
        eyebrow: 'Made for your everyday',
        title: 'Your everyday.<br><em>Elevated.</em>',
        text: 'Thoughtfully chosen essentials that bring a little more style, comfort and confidence to every day.',
        image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1800&q=85',
        ctaPrimary: { text: 'Shop the collection', link: '#new-arrivals' },
        ctaSecondary: { text: 'Discover our story', link: '#story' },
        note: 'Considered design. Everyday quality.'
      },
      {
        eyebrow: 'New Season Arrival',
        title: 'Crafted for motion.<br><em>Built for living.</em>',
        text: 'Lightweight, versatile silhouettes tailored for seamless transit between workdays and weekends.',
        image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1800&q=85',
        ctaPrimary: { text: 'Explore New Arrivals', link: '#new-arrivals' },
        ctaSecondary: { text: 'Browse Collections', link: '#categories' },
        note: '100% Sustainable finishes. Water-resistant.'
      },
      {
        eyebrow: 'Curated Travel Edit',
        title: 'The Weekend<br><em>Getaway Capsule.</em>',
        text: 'Spacious compartments, durable brass hardware, and minimalist luxury that travels effortlessly with you.',
        image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1800&q=85',
        ctaPrimary: { text: 'Shop Travel Edit', link: '#new-arrivals' },
        ctaSecondary: { text: 'Why Shop With Us', link: '#benefits' },
        note: 'Complimentary shipping on orders over $50.'
      }
    ];

    this.innerHTML = `
      <section class="hero hero--carousel" aria-label="Featured Highlights">
        <div class="hero__track">
          ${slides.map((s, idx) => `
            <div class="hero__slide ${idx === 0 ? 'is-active' : ''}" data-index="${idx}" aria-hidden="${idx === 0 ? 'false' : 'true'}">
              <div class="hero__media">
                <img src="${s.image}" alt="${s.eyebrow}" ${idx === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}>
              </div>
              <div class="hero__overlay"></div>
              <div class="hero__content">
                <div class="hero__copy">
                  <div class="eyebrow hero__anim hero__anim--1">${s.eyebrow}</div>
                  <h1 class="hero__anim hero__anim--2">${s.title}</h1>
                  <p class="hero__anim hero__anim--3">${s.text}</p>
                  <div class="hero__actions hero__anim hero__anim--4">
                    <a class="btn" href="${s.ctaPrimary.link}">${s.ctaPrimary.text} <span aria-hidden="true">→</span></a>
                    <a class="btn btn--outline" href="${s.ctaSecondary.link}">${s.ctaSecondary.text}</a>
                  </div>
                  <div class="hero__note hero__anim hero__anim--5">
                    <span class="hero__note-dot"></span> ${s.note}
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <button class="hero__control hero__control--prev" aria-label="Previous slide" data-hero-prev>
          ${icon('chevronLeft')}
        </button>
        <button class="hero__control hero__control--next" aria-label="Next slide" data-hero-next>
          ${icon('chevronRight')}
        </button>

        <div class="hero__dots" role="tablist" aria-label="Slide indicators">
          ${slides.map((_, idx) => `
            <button class="hero__dot ${idx === 0 ? 'is-active' : ''}" role="tab" aria-selected="${idx === 0}" aria-label="Slide ${idx + 1}" data-hero-dot="${idx}">
              <span class="hero__dot-fill"></span>
            </button>
          `).join('')}
        </div>

        <div class="hero__peek-indicator">
          <span>Scroll to explore</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 10l5 5 5-5"/></svg>
        </div>
      </section>
    `;

    this.initCarousel(slides.length);
  }

  initCarousel(totalSlides) {
    let currentIndex = 0;
    let timer = null;
    const slides = this.querySelectorAll('.hero__slide');
    const dots = this.querySelectorAll('.hero__dot');
    const prevBtn = this.querySelector('[data-hero-prev]');
    const nextBtn = this.querySelector('[data-hero-next]');
    const heroEl = this.querySelector('.hero');

    const goTo = (index) => {
      currentIndex = (index + totalSlides) % totalSlides;
      slides.forEach((slide, i) => {
        const isActive = i === currentIndex;
        slide.classList.toggle('is-active', isActive);
        slide.setAttribute('aria-hidden', String(!isActive));

        // Re-trigger animation by cycling anim class if active
        if (isActive) {
          const copy = slide.querySelector('.hero__copy');
          if (copy) {
            copy.classList.remove('hero__copy--flow');
            void copy.offsetWidth; // force reflow
            copy.classList.add('hero__copy--flow');
          }
        }
      });

      dots.forEach((dot, i) => {
        const isActive = i === currentIndex;
        dot.classList.toggle('is-active', isActive);
        dot.setAttribute('aria-selected', String(isActive));
      });
    };

    const next = () => goTo(currentIndex + 1);
    const prev = () => goTo(currentIndex - 1);

    const startAutoplay = () => {
      stopAutoplay();
      timer = setInterval(next, 5200);
    };

    const stopAutoplay = () => {
      if (timer) clearInterval(timer);
    };

    if (prevBtn) prevBtn.addEventListener('click', () => { prev(); startAutoplay(); });
    if (nextBtn) nextBtn.addEventListener('click', () => { next(); startAutoplay(); });

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        goTo(i);
        startAutoplay();
      });
    });

    heroEl.addEventListener('mouseenter', stopAutoplay);
    heroEl.addEventListener('mouseleave', startAutoplay);

    // Touch swipe support for mobile
    let touchStartX = 0;
    let touchEndX = 0;

    heroEl.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      stopAutoplay();
    }, { passive: true });

    heroEl.addEventListener('touchend', (e) => {
      touchEndX = e.changedTouches[0].screenX;
      if (touchStartX - touchEndX > 45) {
        next();
      } else if (touchEndX - touchStartX > 45) {
        prev();
      }
      startAutoplay();
    }, { passive: true });

    startAutoplay();
  }
}

class TrustStrip extends HTMLElement {
  connectedCallback() {
    const items = [
      ['↗', 'Easy everyday style', 'Pieces made to be lived in'],
      ['◇', 'Thoughtful quality', 'Details you can feel'],
      ['♡', 'Customer-first service', 'Here when you need us'],
      ['⌁', 'Secure checkout', 'Shop with confidence']
    ];
    this.innerHTML = `
      <section class="trust-strip reveal-on-scroll">
        <div class="container trust-grid">
          ${items.map(([i, t, s]) => `
            <div class="trust-item stagger-item">
              <span class="trust-icon">${i}</span>
              <span><strong>${t}</strong><small>${s}</small></span>
            </div>
          `).join('')}
        </div>
      </section>`;
  }
}

class CategorySection extends HTMLElement {
  connectedCallback() {
    const cats = [
      ['Everyday bags', 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=85', 'the-everyday-tote'],
      ['Work & travel', 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=85', 'the-weekender'],
      ['Weekend edit', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=85', 'the-city-crossbody'],
      ['New season', 'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=85', 'the-mini-shoulder']
    ];
    this.innerHTML = `
      <section class="section reveal-on-scroll" id="categories">
        <div class="container">
          <div class="section-heading">
            <div>
              <div class="eyebrow">Find your favourite</div>
              <h2>Shop by collection</h2>
            </div>
            <a class="text-link" href="#new-arrivals">Explore all <span>→</span></a>
          </div>
          <div class="category-grid">
            ${cats.map(([n, img, prodId]) => `
              <a class="category-card stagger-item" href="product.html?id=${prodId}">
                <img src="${img}" alt="${n}" loading="lazy">
                <span class="category-card__label">
                  <strong>${n}</strong>
                  <span aria-hidden="true">↗</span>
                </span>
              </a>
            `).join('')}
          </div>
        </div>
      </section>`;
  }
}

class ProductSection extends HTMLElement {
  connectedCallback() {
    const catalog = window.PRODUCT_CATALOG || [
      { id: 'the-everyday-tote', name: 'The Everyday Tote', cat: 'Everyday essentials', price: 48, sale: 60, badge: 'Bestseller', gallery: ['https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=85'] },
      { id: 'the-city-crossbody', name: 'The City Crossbody', cat: 'On the go', price: 42, sale: 52, badge: 'New', gallery: ['https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=85'] },
      { id: 'the-weekender', name: 'The Weekender', cat: 'Travel edit', price: 68, sale: 82, badge: 'Popular', gallery: ['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=85'] },
      { id: 'the-mini-shoulder', name: 'The Mini Shoulder', cat: 'Finishing touches', price: 38, sale: 48, badge: '', gallery: ['https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=85'] }
    ];

    this.innerHTML = `
      <section class="section reveal-on-scroll" id="new-arrivals">
        <div class="container">
          <div class="section-heading">
            <div>
              <div class="eyebrow">Just landed</div>
              <h2>New arrivals</h2>
              <p style="margin-top:10px">The latest pieces to make your everyday a little more special.</p>
            </div>
            <a class="text-link" href="#categories">View all products <span>→</span></a>
          </div>
          <div class="product-grid">
            ${catalog.map((p) => {
              const mainImg = p.gallery && p.gallery[0] ? p.gallery[0] : (p.img ? `https://images.unsplash.com/${p.img}?auto=format&fit=crop&w=800&q=85` : '');
              return `
                <article class="product-card stagger-item" data-product-id="${p.id}">
                  <div class="product-card__image">
                    <a href="product.html?id=${p.id}" class="product-card__img-link" aria-label="View details for ${p.name}">
                      <img src="${mainImg}" alt="${p.name}" loading="lazy">
                    </a>
                    ${p.badge ? `<span class="product-badge">${p.badge}</span>` : ''}
                    
                    <div class="product-card__floating-actions">
                      <button class="product-action-btn product-quickview-btn" aria-label="Quick view ${p.name}" data-quickview="${p.id}" title="Quick view">
                        ${icon('eye')}
                        <span class="action-tooltip">Quick view</span>
                      </button>
                      <button class="product-action-btn product-wish" aria-label="Add ${p.name} to wishlist" data-wish data-product-id="${p.id}" title="Add to wishlist">
                        ♡
                      </button>
                    </div>
                  </div>
                  <div class="product-card__details">
                    <div class="product-card__category">${p.cat}</div>
                    <h3 class="product-card__title">
                      <a href="product.html?id=${p.id}">${p.name}</a>
                    </h3>
                    <div class="product-price">
                      <span>$${p.price.toFixed(2)}</span>
                      ${p.sale ? `<del>$${p.sale.toFixed(2)}</del>` : ''}
                    </div>
                    <button class="product-add" data-add-to-cart data-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-image="${mainImg}">
                      Add to bag +
                    </button>
                  </div>
                </article>
              `;
            }).join('')}
          </div>
        </div>
      </section>`;
  }
}

class EditorialBanner extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <section class="section reveal-on-scroll" id="story">
        <div class="container">
          <div class="editorial">
            <div class="editorial__image">
              <img src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1100&q=85" alt="A thoughtfully designed bag ready for a day out" loading="lazy">
            </div>
            <div class="editorial__content">
              <div class="eyebrow">A little more considered</div>
              <h2>Good design.<br>Better everyday.</h2>
              <p>We believe the pieces you reach for most should be the ones you love most. That's why we focus on useful details, considered design and lasting style.</p>
              <a href="#categories" class="btn">Get to know us <span>→</span></a>
            </div>
          </div>
        </div>
      </section>`;
  }
}

class BenefitsSection extends HTMLElement {
  connectedCallback() {
    const items = [
      ['✳', 'Considered by design', 'Practical details and versatile styles that work with your everyday routine.'],
      ['⌂', 'Made for real life', 'Easy-to-use pieces designed to go from busy weekdays to relaxed weekends.'],
      ['♡', 'Here for you', 'A friendly team and a straightforward shopping experience, every step of the way.']
    ];
    this.innerHTML = `
      <section class="section reveal-on-scroll" id="benefits">
        <div class="container">
          <div class="section-heading">
            <div>
              <div class="eyebrow">The difference is in the details</div>
              <h2>Why shop with us?</h2>
            </div>
          </div>
          <div class="benefits-grid">
            ${items.map(([i, t, d]) => `
              <article class="benefit stagger-item">
                <span class="benefit__icon">${i}</span>
                <h3>${t}</h3>
                <p>${d}</p>
              </article>
            `).join('')}
          </div>
        </div>
      </section>`;
  }
}

class NewsletterSection extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <section class="section newsletter reveal-on-scroll">
        <div class="container newsletter__inner">
          <div class="eyebrow">The good stuff, occasionally</div>
          <h2>Join our community</h2>
          <p>Get first access to new arrivals, thoughtful edits and special offers.</p>
          <form class="newsletter-form" data-newsletter>
            <label class="sr-only" for="newsletter-email">Email address</label>
            <input id="newsletter-email" type="email" placeholder="Your email address" required>
            <button class="btn" type="submit">Sign me up →</button>
          </form>
        </div>
      </section>`;
  }
}

class SiteFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              <img class="brand-logo" src="assets/brand-logo.png" alt="Your Brand logo">
              <p style="max-width:270px;margin-top:18px">Everyday essentials, thoughtfully chosen. A little more style for the moments that make up your day.</p>
            </div>
            <div>
              <h3>Explore</h3>
              <div class="footer-links">
                <a href="#categories">Collections</a>
                <a href="#new-arrivals">New arrivals</a>
                <a href="#story">Our story</a>
                <a href="#benefits">Why us</a>
              </div>
            </div>
            <div>
              <h3>Help & support</h3>
              <div class="footer-links">
                <a href="#footer">Contact us</a>
                <a href="#footer">Shipping information</a>
                <a href="#footer">Returns & exchanges</a>
                <a href="#footer">FAQs</a>
              </div>
            </div>
            <div>
              <h3>Stay connected</h3>
              <p>Follow along for new arrivals, ideas and everyday inspiration.</p>
              <div class="footer-links" style="margin-top:14px">
                <a href="#footer">Instagram ↗</a>
                <a href="#footer">Facebook ↗</a>
              </div>
            </div>
          </div>
          <div class="footer-bottom" id="footer">
            <small>© <span data-year></span> Your Brand. All rights reserved.</small>
            <small>Privacy policy&nbsp;&nbsp; · &nbsp;&nbsp;Terms of service</small>
          </div>
        </div>
      </footer>`;
  }
}

class CartDrawer extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="cart-overlay" data-cart-close></div>
      <aside class="cart-panel" role="dialog" aria-modal="true" aria-label="Shopping bag">
        <div class="cart-head">
          <h2>Your bag <span data-drawer-count>(0)</span></h2>
          <button class="icon-button" data-cart-close aria-label="Close shopping bag">${icon('close')}</button>
        </div>
        <div class="cart-items" data-cart-items>
          <div class="cart-empty">Your bag is waiting for something lovely.</div>
        </div>
        <div class="cart-foot">
          <div class="cart-total">
            <span>Subtotal</span>
            <span data-cart-total>$0.00</span>
          </div>
          <button class="btn" style="width:100%" data-checkout>Continue to checkout →</button>
          <p style="font-size:11px;text-align:center;margin-top:12px;color:var(--muted)">Shipping and taxes calculated at checkout.</p>
        </div>
      </aside>`;
  }
}

class QuickViewModal extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <div class="quickview-overlay" data-quickview-close></div>
      <div class="quickview-dialog" role="dialog" aria-modal="true" aria-label="Quick product preview">
        <div class="quickview-handle" aria-hidden="true"></div>
        <button class="quickview-close" data-quickview-close aria-label="Close quick view">${icon('close')}</button>
        <div class="quickview-body" data-quickview-body>
          <!-- Dynamic product content injected here -->
        </div>
      </div>
    `;
  }
}

class MobileAppNav extends HTMLElement {
  connectedCallback() {
    const isPdp = window.location.pathname.includes('product.html');
    const homeHref = isPdp ? 'index.html' : '#';
    const shopHref = isPdp ? 'index.html#new-arrivals' : '#new-arrivals';

    this.innerHTML = `
      <nav class="mobile-app-bar" aria-label="Mobile app navigation">
        <a href="${homeHref}" class="mobile-app-bar__item ${!isPdp ? 'is-active' : ''}">
          <span class="mobile-app-bar__icon">${icon('home')}</span>
          <span class="mobile-app-bar__label">Home</span>
        </a>
        <a href="${shopHref}" class="mobile-app-bar__item ${isPdp ? 'is-active' : ''}">
          <span class="mobile-app-bar__icon">${icon('grid')}</span>
          <span class="mobile-app-bar__label">Shop</span>
        </a>
        <button type="button" class="mobile-app-bar__item" data-wishlist-view>
          <span class="mobile-app-bar__icon">${icon('heart')}</span>
          <span class="mobile-app-bar__label">Saved</span>
        </button>
        <button type="button" class="mobile-app-bar__item" data-cart-open>
          <span class="mobile-app-bar__icon">
            ${icon('bag')}
            <span class="mobile-app-bar__badge" data-cart-count>0</span>
          </span>
          <span class="mobile-app-bar__label">Bag</span>
        </button>
        <button type="button" class="mobile-app-bar__item" data-account>
          <span class="mobile-app-bar__icon">${icon('user')}</span>
          <span class="mobile-app-bar__label">Account</span>
        </button>
      </nav>
    `;
  }
}

customElements.define('site-announcement', SiteAnnouncement);
customElements.define('site-header', SiteHeader);
customElements.define('hero-banner', HeroBanner);
customElements.define('trust-strip', TrustStrip);
customElements.define('category-section', CategorySection);
customElements.define('product-section', ProductSection);
customElements.define('editorial-banner', EditorialBanner);
customElements.define('benefits-section', BenefitsSection);
customElements.define('newsletter-section', NewsletterSection);
customElements.define('site-footer', SiteFooter);
customElements.define('cart-drawer', CartDrawer);
customElements.define('quick-view-modal', QuickViewModal);
customElements.define('mobile-app-nav', MobileAppNav);